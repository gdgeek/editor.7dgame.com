/** Standard message envelope for iframe communication. */
export interface StandardMessage {
  type: string;
  id: string;
  payload?: Record<string, unknown>;
  requestId?: string;
}

/** Callback signature for registered message handlers. */
export type MessageHandler = (payload: unknown, msg: StandardMessage) => void;

/** Generate a unique message ID. */
function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Vanilla JS message bridge for iframe ↔ parent window communication
 * using the standard envelope format.
 *
 * Unlike the Blockly `useMessageBridge` composable, this class has no
 * Vue dependency and manages its own lifecycle via `init()` / `destroy()`.
 *
 * - Sends messages via `{ type, id, payload, requestId? }`
 * - Receives messages filtered by `event.source === window.parent`
 * - Routes by `message.type`
 * - Tracks `lastRequestId` for REQUEST/RESPONSE pairing
 */
export class MessageBridge {
  private handlers = new Map<string, MessageHandler>();

  /** The id of the last received REQUEST, used for RESPONSE pairing. */
  private lastRequestId: string | undefined;

  /** Bound reference kept so we can remove the listener in `destroy()`. */
  private boundHandleMessage: ((event: MessageEvent) => void) | null = null;

  // ── Outgoing ──────────────────────────────────────────────

  /** Register a handler for a specific incoming message type. */
  onMessage(type: string, handler: MessageHandler): void {
    this.handlers.set(type, handler);
  }

  /** Send a message to the parent window using the standard envelope format. */
  postMessage(type: string, payload?: Record<string, unknown>): void {
    const msg: StandardMessage = { type, id: genId() };
    if (payload !== undefined) {
      msg.payload = payload;
    }
    window.parent.postMessage(msg, "*");
  }

  /**
   * Send a RESPONSE message, auto-attaching `lastRequestId` as `requestId`.
   * An explicit `requestId` can be provided to override the automatic value.
   */
  postResponse(payload: Record<string, unknown>, requestId?: string): void {
    const msg: StandardMessage = { type: "RESPONSE", id: genId(), payload };
    const rid = requestId ?? this.lastRequestId;
    if (rid !== undefined) {
      msg.requestId = rid;
    }
    window.parent.postMessage(msg, "*");
  }

  // ── Lifecycle ─────────────────────────────────────────────

  /** Initialise: attach the `message` event listener and send PLUGIN_READY. */
  init(): void {
    this.boundHandleMessage = this.handleMessage.bind(this);
    window.addEventListener("message", this.boundHandleMessage);
    this.postMessage("PLUGIN_READY");
  }

  /** Tear down: remove all event listeners. */
  destroy(): void {
    if (this.boundHandleMessage) {
      window.removeEventListener("message", this.boundHandleMessage);
      this.boundHandleMessage = null;
    }
  }

  // ── Incoming (private) ────────────────────────────────────

  /**
   * Core message handler attached to `window`.
   * Filters by `event.source === window.parent`, routes by `msg.type`.
   */
  private handleMessage(event: MessageEvent): void {
    try {
      if (event.source !== window.parent) return;

      const msg = event.data as StandardMessage;
      if (!msg || typeof msg.type !== "string") return;

      // Track REQUEST id for RESPONSE pairing
      if (msg.type === "REQUEST") {
        this.lastRequestId = msg.id;
      }

      const handler = this.handlers.get(msg.type);
      if (handler) {
        handler(msg.payload, msg);
      }
    } catch (e) {
      console.error(e);
    }
  }
}
