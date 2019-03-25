import { RSPClient, Incoming, Outgoing, OutgoingSynchronous, ServerCreation } from 'rsp-client';

export class Stubs {

  public clientStub: sinon.SinonStubbedInstance<RSPClient>;
  public get client(): RSPClient { return <RSPClient><unknown>this.clientStub; }
  public incoming: sinon.SinonStubbedInstance<Incoming>;
  public outgoing: sinon.SinonStubbedInstance<Outgoing>;
  public outgoingSync: sinon.SinonStubbedInstance<OutgoingSynchronous>;
  public serverCreation: sinon.SinonStubbedInstance<ServerCreation>;

  constructor(sandbox: sinon.SinonSandbox) {
    this.clientStub = sandbox.stub(RSPClient.prototype);
    this.clientStub.connect.resolves();

    this.outgoing = sandbox.createStubInstance(Outgoing);
    this.clientStub.getOutgoingHandler.returns(<Outgoing><unknown> this.outgoing);

    this.outgoingSync = sandbox.createStubInstance(OutgoingSynchronous);
    this.clientStub.getOutgoingSyncHandler.returns(<OutgoingSynchronous><unknown> this.outgoingSync);

    this.incoming = sandbox.createStubInstance(Incoming);
    this.clientStub.getIncomingHandler.returns(<Incoming><unknown> this.incoming);

    this.serverCreation = sandbox.createStubInstance(ServerCreation);
    this.clientStub.getServerCreation.returns(this.serverCreation);
  }
}
