import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3001')
      .split(',')
      .map((o) => o.trim()),
    credentials: true,
  },
})
export class ResultsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('ResultsGateway');

  @SubscribeMessage('joinEvent')
  handleJoinEvent(client: Socket, eventId: string) {
    client.join(`event_${eventId}`);
    this.logger.log(`Client ${client.id} joined event_${eventId}`);
  }

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway Initialized');
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  broadcastUpdate(eventId: string, data: any) {
    if (this.server) {
      this.server.to(`event_${eventId}`).emit('resultsUpdated', data);
    }
  }

  // Standard way to close server during tests
  onModuleDestroy() {
    if (this.server) {
      this.server.close();
    }
  }
}
