import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { randomUUID } from "crypto";
import {
  ClientToServerEvents,
  RegenerateRequestSchema,
  SendMessageRequestSchema,
  ServerToClientEvents,
} from "@sabsepehle/shared-types";
import { ChatService } from "./chat.service";

@WebSocketGateway({
  namespace: "/chat",
  cors: { origin: process.env.CORS_ORIGIN ?? "*", credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: Socket): void {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage(ClientToServerEvents.JOIN_SESSION)
  handleJoin(@ConnectedSocket() client: Socket, @MessageBody() payload: { sessionId: string }): void {
    if (!payload?.sessionId) return;
    client.join(payload.sessionId);
  }

  @SubscribeMessage(ClientToServerEvents.SEND_MESSAGE)
  async handleSendMessage(@ConnectedSocket() client: Socket, @MessageBody() rawPayload: unknown): Promise<void> {
    const parsed = SendMessageRequestSchema.safeParse(rawPayload);
    if (!parsed.success) {
      client.emit(ServerToClientEvents.ERROR, {
        sessionId: (rawPayload as { sessionId?: string })?.sessionId ?? "unknown",
        message: "Invalid message payload",
      });
      return;
    }

    const { sessionId, content } = parsed.data;
    if (!sessionId) {
      client.emit(ServerToClientEvents.ERROR, { sessionId: "unknown", message: "sessionId is required" });
      return;
    }

    client.join(sessionId);
    const room = this.server.to(sessionId);
    const streamId = randomUUID();

    try {
      const message = await this.chatService.handleUserMessage(sessionId, content, streamId, {
        onCitations: (citations) => {
          room.emit(ServerToClientEvents.CITATIONS, { sessionId, messageId: streamId, citations });
        },
        onToken: (token) => {
          room.emit(ServerToClientEvents.TOKEN, { sessionId, messageId: streamId, token });
        },
      });

      room.emit(ServerToClientEvents.MESSAGE_COMPLETE, { sessionId, message });

      if (message.status === "rejected_out_of_domain") {
        room.emit(ServerToClientEvents.MESSAGE_REJECTED, {
          sessionId,
          messageId: message.id,
          reason: "out_of_domain",
          suggestedQuestions: [],
        });
      }
    } catch (error) {
      this.logger.error(`chat:send failed for session ${sessionId}: ${error}`);
      room.emit(ServerToClientEvents.ERROR, {
        sessionId,
        messageId: streamId,
        message: error instanceof Error ? error.message : "Failed to generate a response",
      });
    }
  }

  @SubscribeMessage(ClientToServerEvents.REGENERATE)
  async handleRegenerate(@ConnectedSocket() client: Socket, @MessageBody() rawPayload: unknown): Promise<void> {
    const parsed = RegenerateRequestSchema.safeParse(rawPayload);
    if (!parsed.success) {
      client.emit(ServerToClientEvents.ERROR, {
        sessionId: (rawPayload as { sessionId?: string })?.sessionId ?? "unknown",
        message: "Invalid regenerate payload",
      });
      return;
    }

    const { sessionId, messageId } = parsed.data;
    client.join(sessionId);
    const room = this.server.to(sessionId);
    const newMessageId = randomUUID();

    try {
      const message = await this.chatService.regenerateMessage(sessionId, messageId, newMessageId, {
        onCitations: (citations) => {
          room.emit(ServerToClientEvents.CITATIONS, { sessionId, messageId: newMessageId, citations });
        },
        onToken: (token) => {
          room.emit(ServerToClientEvents.TOKEN, { sessionId, messageId: newMessageId, token });
        },
      });

      room.emit(ServerToClientEvents.MESSAGE_COMPLETE, { sessionId, message });
    } catch (error) {
      this.logger.error(`chat:regenerate failed for session ${sessionId}: ${error}`);
      room.emit(ServerToClientEvents.ERROR, {
        sessionId,
        messageId: newMessageId,
        message: error instanceof Error ? error.message : "Failed to regenerate response",
      });
    }
  }
}
