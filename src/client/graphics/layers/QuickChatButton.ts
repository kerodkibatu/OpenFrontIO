import { LitElement, html, css } from "lit";
import { customElement, state, property } from "lit/decorators.js";
import { EventBus } from "../../../core/EventBus";
import { GameView, PlayerView } from "../../../core/game/GameView";
import { UserSettings } from "../../../core/game/UserSettings";
import { PlayerType } from "../../../core/game/Game";
import { SendQuickChatEvent } from "../../Transport";
import { translateText } from "../../Utils";
import { MouseUpEvent, MouseMoveEvent } from "../../InputHandler";
import { quickChatPhrases, QuickChatPhrase } from "./ChatModal";
import { Layer } from "./Layer";
import { TransformHandler } from "../TransformHandler";
import { TileRef } from "../../../core/game/GameMap";
import { Colord } from "colord";
import chatIcon from "../../../../resources/images/ChatIconWhite.svg";

export class QuickChatSelectionModeEvent {
  constructor(
    public readonly favorite: { category: string; key: string },
    public readonly phrase: QuickChatPhrase,
  ) {}
}

export class QuickChatRecipientSelectedEvent {
  constructor(public readonly recipient: PlayerView) {}
}

export class CancelQuickChatSelectionEvent {
  constructor() {}
}

export class QuickChatClickConsumedEvent {
  constructor() {}
}

@customElement("quick-chat-button")
export class QuickChatButton extends LitElement implements Layer {
  @property({ type: Object })
  public game!: GameView;

  @property({ type: Object })
  public eventBus!: EventBus;

  @property({ type: Object })
  public userSettings!: UserSettings;

  @property({ type: Object })
  public transformHandler!: TransformHandler;

  @state() private _isVisible = false;
  @state() private isSelectionMode = false;
  @state() private showDropdown = false;
  @state() private selectedFavorite: { category: string; key: string } | null = null;
  @state() private selectedPhrase: QuickChatPhrase | null = null;
  @state() private selectedRecipient: PlayerView | null = null;
  @state() private previewText: string | null = null;
  @state() private hoveredPlayer: PlayerView | null = null;
  @state() private lastMousePosition: { x: number; y: number } | null = null;
  private borderTilesCache: Map<PlayerView, ReadonlySet<TileRef>> = new Map();
  private borderTilesCacheTime: Map<PlayerView, number> = new Map();
  private readonly BORDER_CACHE_TTL = 1000; // Refresh border tiles every 1 second

  private favorites: Array<{ category: string; key: string; order: number }> = [];

  init() {
    this.eventBus.on(QuickChatSelectionModeEvent, (e) => {
      this.enterSelectionMode(e.favorite, e.phrase);
    });

    this.eventBus.on(QuickChatRecipientSelectedEvent, (e) => {
      this.selectedRecipient = e.recipient;
      if (this.selectedFavorite && this.selectedPhrase) {
        // Update preview - still show template, target will be selected next
        this.previewText = translateText(`chat.${this.selectedFavorite.category}.${this.selectedFavorite.key}`);
      }
      this.requestUpdate();
    });

    this.eventBus.on(CancelQuickChatSelectionEvent, () => {
      this.exitSelectionMode();
    });

    // Listen for left-click events when in selection mode
    // Note: This handler must run BEFORE ClientGameRunner's handler
    this.eventBus.on(MouseUpEvent, (e) => {
      if (this.isSelectionMode) {
        // Check if we'll handle this click before emitting consumed event
        if (this.game && this.transformHandler && this.selectedFavorite && this.selectedPhrase) {
          const worldCoords = this.transformHandler.screenToWorldCoordinates(e.x, e.y);
          if (this.game.isValidCoord(worldCoords.x, worldCoords.y)) {
            const tile = this.game.ref(worldCoords.x, worldCoords.y);
            const tileOwner = this.game.owner(tile);
            if (tileOwner.isPlayer()) {
              // Emit consumed event BEFORE handling so ClientGameRunner can check
              this.eventBus.emit(new QuickChatClickConsumedEvent());
            }
          }
        }
        this.handlePlayerSelection(e);
      }
    });

    // Listen for mouse move events to track hovered player
    this.eventBus.on(MouseMoveEvent, (e) => {
      if (this.isSelectionMode) {
        this.updateHoveredPlayer(e.x, e.y);
      }
    });

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("click", this.handleClickOutside);
    
    // Load initial favorites
    this.favorites = this.userSettings.getQuickChatFavorites();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("click", this.handleClickOutside);
  }

  private handleClickOutside = (e: MouseEvent) => {
    const target = e.target as Node;
    if (this.showDropdown && !this.contains(target)) {
      this.showDropdown = false;
      this.requestUpdate();
    }
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === "Escape") {
      if (this.isSelectionMode) {
        e.preventDefault();
        this.exitSelectionMode();
      } else if (this.showDropdown) {
        e.preventDefault();
        this.showDropdown = false;
        this.requestUpdate();
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    // Handle keyboard shortcuts for favorites (1-5 keys)
    if (this.isSelectionMode) return;

    const shortcuts = this.userSettings.getQuickChatShortcuts();
    const favoriteIndex = shortcuts[e.code];

    if (favoriteIndex !== undefined && this.favorites[favoriteIndex]) {
      const favorite = this.favorites[favoriteIndex];
      const phrase = quickChatPhrases[favorite.category]?.find(
        (p) => p.key === favorite.key,
      );

      if (phrase) {
        this.eventBus.emit(
          new QuickChatSelectionModeEvent(favorite, phrase),
        );
      }
    }
  };

  tick() {
    // Update visibility based on settings and game state
    const player = this.game?.myPlayer();
    const shouldBeVisible =
      this.userSettings.quickChatButtonVisible() &&
      player !== null &&
      player.isAlive() &&
      !this.game.inSpawnPhase();

    if (this._isVisible !== shouldBeVisible) {
      this._isVisible = shouldBeVisible;
      this.requestUpdate();
    }

    // Reload favorites
    this.favorites = this.userSettings.getQuickChatFavorites();

    // Refresh border tiles for hovered player periodically to keep highlight up to date
    if (this.isSelectionMode && this.hoveredPlayer) {
      const lastCacheTime = this.borderTilesCacheTime.get(this.hoveredPlayer) || 0;
      const now = Date.now();
      
      if (now - lastCacheTime > this.BORDER_CACHE_TTL) {
        // Refresh border tiles
        this.refreshBorderTiles(this.hoveredPlayer);
      }
    }
  }

  private async refreshBorderTiles(player: PlayerView) {
    try {
      const tiles = await player.borderTiles();
      this.borderTilesCache.set(player, tiles.borderTiles);
      this.borderTilesCacheTime.set(player, Date.now());
      // Trigger re-render to update highlight
      if (this.hoveredPlayer?.id() === player.id()) {
        this.requestUpdate();
      }
    } catch (e) {
      console.error("Failed to refresh border tiles:", e);
    }
  }

  renderLayer(context: CanvasRenderingContext2D) {
    // Render highlight for hovered player during selection mode
    if (this.isSelectionMode && this.hoveredPlayer) {
      this.renderPlayerHighlight(context, this.hoveredPlayer);
    }
  }

  shouldTransform(): boolean {
    // Need transform to render highlights - always true when in selection mode
    return this.isSelectionMode;
  }

  private renderPlayerHighlight(context: CanvasRenderingContext2D, player: PlayerView) {
    if (!this.game || !this.transformHandler) return;

    // Get border tiles from cache (should be loaded by updateHoveredPlayer)
    const borderTiles = this.borderTilesCache.get(player);
    if (!borderTiles) {
      // Border tiles not loaded yet, skip rendering this frame
      return;
    }

    // Highlight color - subtle yellow for visibility without being harsh
    const highlightColor = new Colord("rgba(255, 255, 0, 0.5)");
    
    context.save();
    context.strokeStyle = highlightColor.toRgbString();
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";

    // Draw highlighted borders - coordinates need to be offset by half the game size
    // because the transform centers the world at (0, 0)
    const offsetX = -this.game.width() / 2;
    const offsetY = -this.game.height() / 2;
    
    borderTiles.forEach((tile: TileRef) => {
      const x = this.game.x(tile) + offsetX;
      const y = this.game.y(tile) + offsetY;
      
      // Draw a highlighted border around each border tile
      context.beginPath();
      context.rect(x - 0.4, y - 0.4, 1.8, 1.8);
      context.stroke();
    });
    
    context.restore();
  }

  private enterSelectionMode(
    favorite: { category: string; key: string },
    phrase: QuickChatPhrase,
  ) {
    this.isSelectionMode = true;
    this.selectedFavorite = favorite;
    this.selectedPhrase = phrase;
    this.selectedRecipient = null; // Reset recipient when entering new selection

    // Show preview - user needs to click recipient, then target (if required)
    this.previewText = translateText(`chat.${favorite.category}.${favorite.key}`);
    this.requestUpdate();
  }

  private exitSelectionMode() {
    this.isSelectionMode = false;
    this.selectedFavorite = null;
    this.selectedPhrase = null;
    this.selectedRecipient = null;
    this.previewText = null;
    this.hoveredPlayer = null;
    this.lastMousePosition = null;
    this.borderTilesCache.clear();
    this.borderTilesCacheTime.clear();
    this.requestUpdate();
  }

  private sendToAllPlayers() {
    if (!this.selectedFavorite || !this.game) return;

    const myPlayer = this.game.myPlayer();
    if (!myPlayer) return;

    const players = this.game
      .players()
      .filter((p) => p.isAlive() && p.data.playerType !== PlayerType.Bot);

    players.forEach((player) => {
      this.eventBus.emit(
        new SendQuickChatEvent(
          player,
          `${this.selectedFavorite!.category}.${this.selectedFavorite!.key}`,
          undefined,
        ),
      );
    });

    this.exitSelectionMode();
  }

  private handlePlayerSelection(event: MouseUpEvent) {
    if (!this.game || !this.transformHandler || !this.isSelectionMode || !this.selectedFavorite || !this.selectedPhrase) {
      return false; // Didn't consume the click
    }

    const worldCoords = this.transformHandler.screenToWorldCoordinates(
      event.x,
      event.y,
    );
    
    if (!this.game.isValidCoord(worldCoords.x, worldCoords.y)) {
      // Cancel selection if clicking outside map
      this.exitSelectionMode();
      return true; // Consumed the click
    }

    const tile = this.game.ref(worldCoords.x, worldCoords.y);
    const tileOwner = this.game.owner(tile);
    
    if (!tileOwner.isPlayer()) {
      // Cancel selection if clicking on non-player tile
      this.exitSelectionMode();
      return true; // Consumed the click
    }

    const clickedPlayer = tileOwner as PlayerView;
    const myPlayer = this.game.myPlayer();
    if (!myPlayer) return false;

    // Prevent double-processing: check current state
    const currentRecipient = this.selectedRecipient;

    // Check if phrase requires a target player
    if (this.selectedPhrase.requiresPlayer) {
      // Two-step selection: recipient first, then target
      if (!currentRecipient) {
        // First click: select recipient and stay in selection mode
        // IMPORTANT: Set recipient BEFORE emitting event to prevent double-processing
        this.selectedRecipient = clickedPlayer;
        this.eventBus.emit(new QuickChatRecipientSelectedEvent(clickedPlayer));
        // Stay in selection mode - user needs to click target next
        this.requestUpdate();
        return true; // Consumed the click
      } else {
        // Second click: select target and send
        // Only send if clicking on a different player (can't select same player as recipient and target)
        if (clickedPlayer.id() === currentRecipient.id()) {
          // Clicked same player twice - ignore or cancel
          return true; // Consumed but ignored
        }
        const target = clickedPlayer;
        this.eventBus.emit(
          new SendQuickChatEvent(
            currentRecipient,
            `${this.selectedFavorite.category}.${this.selectedFavorite.key}`,
            target.id(),
          ),
        );
        this.exitSelectionMode();
        return true; // Consumed the click
      }
    } else {
      // No target needed - just send to recipient
      this.eventBus.emit(
        new SendQuickChatEvent(
          clickedPlayer,
          `${this.selectedFavorite.category}.${this.selectedFavorite.key}`,
          undefined,
        ),
      );
      this.exitSelectionMode();
      return true; // Consumed the click
    }
  }

  private handleButtonClick() {
    if (this.favorites.length === 0) return;
    this.showDropdown = !this.showDropdown;
    this.requestUpdate();
  }

  private handleFavoriteClick(favorite: { category: string; key: string; order: number }) {
    const phrase = quickChatPhrases[favorite.category]?.find(
      (p) => p.key === favorite.key,
    );

    if (!phrase) {
      console.warn(`Favorite phrase not found: ${favorite.category}.${favorite.key}`);
      return;
    }

    this.showDropdown = false;
    
    // Always enter selection mode - user must select recipient
    this.eventBus.emit(
      new QuickChatSelectionModeEvent(favorite, phrase),
    );
  }

  private async updateHoveredPlayer(x: number, y: number) {
    if (!this.game || !this.transformHandler || !this.isSelectionMode) {
      return;
    }

    this.lastMousePosition = { x, y };
    const worldCoords = this.transformHandler.screenToWorldCoordinates(x, y);
    
    if (!this.game.isValidCoord(worldCoords.x, worldCoords.y)) {
      if (this.hoveredPlayer) {
        this.hoveredPlayer = null;
        // Trigger re-render by updating state
        this.requestUpdate();
      }
      return;
    }

    const tile = this.game.ref(worldCoords.x, worldCoords.y);
    const tileOwner = this.game.owner(tile);
    
    if (!tileOwner.isPlayer()) {
      if (this.hoveredPlayer) {
        this.hoveredPlayer = null;
        // Trigger re-render by updating state
        this.requestUpdate();
      }
      return;
    }

    const player = tileOwner as PlayerView;
    if (this.hoveredPlayer?.id() !== player.id()) {
      const previousPlayer = this.hoveredPlayer;
      this.hoveredPlayer = player;
      // Load border tiles asynchronously
      if (!this.borderTilesCache.has(player)) {
        try {
          const tiles = await player.borderTiles();
          this.borderTilesCache.set(player, tiles.borderTiles);
          this.borderTilesCacheTime.set(player, Date.now());
          // Force re-render after tiles are loaded
          if (this.hoveredPlayer?.id() === player.id()) {
            this.requestUpdate();
          }
        } catch (e) {
          console.error("Failed to load border tiles:", e);
        }
      } else {
        // Update cache time even if already cached
        this.borderTilesCacheTime.set(player, Date.now());
      }
      // Trigger re-render when hovered player changes
      if (previousPlayer?.id() !== player.id()) {
        this.requestUpdate();
      }
    }
  }

  render() {
    if (!this._isVisible) return html``;

    const sortedFavorites = [...this.favorites].sort((a, b) => a.order - b.order);

    return html`
      <style>
        .quick-chat-container {
          position: fixed;
          bottom: 60px;
          right: 10px;
          z-index: 51;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          align-items: flex-end;
          pointer-events: auto;
        }

        @media (max-width: 768px) {
          .quick-chat-container {
            bottom: 80px;
            right: 5px;
          }
        }

        .quick-chat-button {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(102, 102, 204, 0.9);
          border: 2px solid rgba(255, 255, 255, 0.3);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .quick-chat-button:hover {
          background: rgba(102, 102, 204, 1);
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }

        .quick-chat-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
        }

        .quick-chat-button:disabled:hover {
          background: rgba(102, 102, 204, 0.9);
          transform: none;
        }

        .quick-chat-button img {
          width: 24px;
          height: 24px;
        }

        .selection-preview {
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          max-width: 300px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        }

        .selection-preview .message {
          margin-bottom: 0.5rem;
        }

        .selection-preview .instruction {
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.75rem;
        }

        .dropdown-menu {
          position: absolute;
          bottom: 60px;
          right: 0;
          min-width: 250px;
          max-width: 350px;
          max-height: 400px;
          overflow-y: auto;
          background: rgba(30, 30, 40, 0.95);
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-radius: 0.5rem;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
          z-index: 52;
          backdrop-filter: blur(10px);
        }

        .dropdown-menu::-webkit-scrollbar {
          width: 8px;
        }

        .dropdown-menu::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }

        .dropdown-menu::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 4px;
        }

        .dropdown-menu::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.5);
        }

        .dropdown-item {
          display: flex;
          align-items: center;
          padding: 0.75rem 1rem;
          color: white;
          cursor: pointer;
          transition: background-color 0.2s;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .dropdown-item:last-child {
          border-bottom: none;
        }

        .dropdown-item:hover {
          background: rgba(102, 102, 204, 0.3);
        }

        .dropdown-item-text {
          flex: 1;
          font-size: 0.875rem;
          word-wrap: break-word;
        }

        .dropdown-item-shortcut {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.6);
          margin-left: 0.5rem;
          padding: 0.25rem 0.5rem;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 0.25rem;
        }

        .dropdown-empty {
          padding: 1rem;
          text-align: center;
          color: rgba(255, 255, 255, 0.6);
          font-size: 0.875rem;
        }
      </style>

      <div class="quick-chat-container">
        ${this.showDropdown && this.favorites.length > 0
          ? html`
              <div class="dropdown-menu" @click=${(e: MouseEvent) => e.stopPropagation()}>
                ${sortedFavorites.length === 0
                  ? html`
                      <div class="dropdown-empty">
                        ${translateText("quick_chat.no_favorites")}
                      </div>
                    `
                  : sortedFavorites.map((favorite, index) => {
                      const phraseText = translateText(`chat.${favorite.category}.${favorite.key}`);
                      return html`
                        <div
                          class="dropdown-item"
                          @click=${() => this.handleFavoriteClick(favorite)}
                        >
                          <span class="dropdown-item-text">${phraseText}</span>
                          <span class="dropdown-item-shortcut">${index + 1}</span>
                        </div>
                      `;
                    })}
              </div>
            `
          : null}

        ${this.isSelectionMode && this.previewText
          ? html`
              <div class="selection-preview">
                <div class="message">${this.previewText}</div>
                <div class="instruction">
                  ${this.selectedRecipient
                    ? translateText("quick_chat.select_target")
                    : this.selectedPhrase?.requiresPlayer
                    ? translateText("quick_chat.select_recipient")
                    : translateText("quick_chat.select_target")}
                  ${this.selectedRecipient ? ` (${this.selectedRecipient.name()})` : ""}
                </div>
                <div class="instruction" style="font-size: 0.7rem; margin-top: 0.25rem;">
                  ${translateText("quick_chat.cancel")}
                </div>
              </div>
            `
          : null}

        <button
          class="quick-chat-button"
          @click=${this.handleButtonClick}
          ?disabled=${this.favorites.length === 0}
          title=${this.favorites.length === 0 
            ? translateText("quick_chat.no_favorites")
            : translateText("quick_chat.button_title")}
        >
          <img src=${chatIcon} alt="Quick Chat" />
        </button>
      </div>
    `;
  }

  createRenderRoot() {
    return this;
  }
}

