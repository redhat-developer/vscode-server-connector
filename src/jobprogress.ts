/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { RSPClient, Protocol, StatusSeverity } from 'rsp-client';

export class JobProgress {

  private static readonly JOB_TIMEOUT: number = 1000 * 60 * 10; // 10 minutes

  private readonly job: Protocol.JobHandle;
  private readonly client: RSPClient;
  private readonly progress: vscode.Progress<{ message?: string, increment?: number }>;
  private readonly cancellation: vscode.CancellationToken;
  private readonly reject: (reason?: any) => void;
  private readonly resolve: (value?: {} | PromiseLike<{}>) => void;
  private timeoutId: NodeJS.Timeout;
  private percents: number = 0;

  public static create(client: RSPClient) {
      client.getIncomingHandler().onJobAdded((jobHandle: Protocol.JobHandle) => {
          vscode.window.withProgress({
              location: vscode.ProgressLocation.Notification,
              title: `Job ${jobHandle.name} started`,
              cancellable: true
          }, (progress, token) => {
              return new Promise<Protocol.JobHandle>((resolve, reject) => {
                new JobProgress(jobHandle, client, progress, token, reject, resolve);
              })
              .catch(error => {
                  if (error) {
                    vscode.window.showErrorMessage(error);
                  }
                  return Promise.reject(error);
              });
          });
      });
  }

  private constructor(job: Protocol.JobHandle, client: RSPClient, progress: vscode.Progress<{ message?: string, increment?: number }>,
      cancellation: vscode.CancellationToken, reject: (reason?: any) => void, resolve: (value?: {} | PromiseLike<{}>) => void) {
      this.job = job;
      this.client = client;
      this.progress = progress;
      this.cancellation = cancellation;
      this.reject = reject;
      this.resolve = resolve;
      this.initListeners();
      this.setTimeout();

      progress.report({ message: `${job.name} started...`, increment: 0 });
  }

  private initListeners() {
      this.cancellation.onCancellationRequested(() => { this.onCancel(); });
      this.client.getIncomingHandler().onJobRemoved((jobRemoved: Protocol.JobRemoved) => { this.onJobRemoved(jobRemoved); });
      this.client.getIncomingHandler().onJobChanged((jobProgress: Protocol.JobProgress) => { this.onJobProgress(jobProgress); });
  }

  private onJobProgress(jobProgress: Protocol.JobProgress) {
      if (!this.isJob(jobProgress.handle)) {
         return;
      }
      this.progress.report({ message: `${jobProgress.percent}%`, increment: jobProgress.percent - this.percents });
      this.percents = jobProgress.percent;
      console.log(`Job ${jobProgress.handle.name} completion is at ${jobProgress.percent}`);
      this.restartTimeout();
  }

  private onJobRemoved(jobRemoved: Protocol.JobRemoved) {
      if (!this.isJob(jobRemoved.handle)) {
          return;
      }
      this.clearTimeout();
      if (!StatusSeverity.isOk(jobRemoved.status)) {
          this.reject(this.getErrorMessage(jobRemoved.status));
      } else {
          this.resolve(this.job);
      }
  }

  private getErrorMessage(status: Protocol.Status) {
    let message = '';
    if (status) {
        message = status.message;
        if (status.trace) {
            const match = /Caused by:([^\n]+)/gm.exec(status.trace);
            if (match && match.length && match.length > 1) {
                message += ':\n' + match[1];
            }
        }
    }
    return message;
  }

  private async onCancel() {
      await this.client.getOutgoingHandler().cancelJob(this.job);
      if (this.timeoutId) {
          this.clearTimeout();
      }
      this.reject();
  }

  private isJob(job: Protocol.JobHandle): boolean {
      return job && this.job.id === job.id;
  }

  private restartTimeout() {
      this.clearTimeout();
      this.setTimeout();
  }

  private setTimeout() {
      this.timeoutId = setTimeout(() => {
          console.log(`Job ${this.job.name} timed out at ${this.percents}`);
          this.reject(`${this.job.name} timed out.`);
      }, JobProgress.JOB_TIMEOUT);
  }

  private clearTimeout() {
      if (this.timeoutId) {
          clearTimeout(this.timeoutId);
      }
  }
}
