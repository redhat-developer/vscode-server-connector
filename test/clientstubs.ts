/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Incoming, Outgoing, OutgoingSynchronous, RSPClient, ServerCreation } from 'rsp-client';

export class ClientStubs {

    public clientStub: sinon.SinonStubbedInstance<RSPClient>;
    public get client(): RSPClient { return this.clientStub as unknown as RSPClient; }
    public incoming: sinon.SinonStubbedInstance<Incoming>;
    public outgoing: sinon.SinonStubbedInstance<Outgoing>;
    public outgoingSync: sinon.SinonStubbedInstance<OutgoingSynchronous>;
    public serverCreation: sinon.SinonStubbedInstance<ServerCreation>;

    constructor(sandbox: sinon.SinonSandbox) {
        this.clientStub = sandbox.stub(RSPClient.prototype);
        this.clientStub.connect.resolves();

        this.outgoing = sandbox.createStubInstance(Outgoing);
        this.clientStub.getOutgoingHandler.returns(this.outgoing as unknown as Outgoing);

        this.outgoingSync = sandbox.createStubInstance(OutgoingSynchronous);
        this.clientStub.getOutgoingSyncHandler.returns(this.outgoingSync as unknown as OutgoingSynchronous);

        this.incoming = sandbox.createStubInstance(Incoming);
        this.clientStub.getIncomingHandler.returns(this.incoming as unknown as Incoming);

        this.serverCreation = sandbox.createStubInstance(ServerCreation);
        this.clientStub.getServerCreation.returns(this.serverCreation as unknown as ServerCreation);
    }
}
