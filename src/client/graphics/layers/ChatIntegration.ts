import { EventBus } from "../../../core/EventBus";
import { PlayerType } from "../../../core/game/Game";
import { GameView, PlayerView } from "../../../core/game/GameView";
import { UserSettings } from "../../../core/game/UserSettings";
import { SendQuickChatEvent } from "../../Transport";
import { translateText } from "../../Utils";
import { ChatModal, QuickChatPhrase, quickChatPhrases } from "./ChatModal";
import { COLORS, MenuElement, MenuElementParams } from "./RadialMenuElements";
import { QuickChatSelectionModeEvent } from "./QuickChatButton";

export class ChatIntegration {
  private ctModal: ChatModal;
  private userSettings: UserSettings;

  constructor(
    private game: GameView,
    private eventBus: EventBus,
  ) {
    this.ctModal = document.querySelector("chat-modal") as ChatModal;
    this.userSettings = new UserSettings();

    if (!this.ctModal) {
      throw new Error(
        "Chat modal element not found. Ensure chat-modal element exists in DOM before initializing ChatIntegration",
      );
    }
  }

  setupChatModal(sender: PlayerView, recipient: PlayerView) {
    this.ctModal.setSender(sender);
    this.ctModal.setRecipient(recipient);
  }

  createQuickChatMenu(recipient: PlayerView): MenuElement[] {
    if (!this.ctModal) {
      throw new Error("Chat modal not set");
    }

    const myPlayer = this.game.myPlayer();
    if (!myPlayer) {
      throw new Error("Current player not found");
    }

    return this.ctModal.categories.map((category) => {
      const categoryTranslation = translateText(`chat.cat.${category.id}`);

      const categoryColor =
        COLORS.chat[category.id as keyof typeof COLORS.chat] ||
        COLORS.chat.default;
      const phrases = quickChatPhrases[category.id] || [];

      const phraseItems: MenuElement[] = phrases.map(
        (phrase: QuickChatPhrase) => {
          const phraseText = translateText(`chat.${category.id}.${phrase.key}`);

          return {
            id: `phrase-${category.id}-${phrase.key}`,
            name: phraseText,
            disabled: () => false,
            text: this.shortenText(phraseText),
            fontSize: "10px",
            color: categoryColor,
            tooltipItems: [
              {
                text: phraseText,
                className: "description",
              },
            ],
            action: (params: MenuElementParams) => {
              if (phrase.requiresPlayer) {
                this.ctModal.openWithSelection(
                  category.id,
                  phrase.key,
                  myPlayer,
                  recipient,
                );
              } else {
                this.eventBus.emit(
                  new SendQuickChatEvent(
                    recipient,
                    `${category.id}.${phrase.key}`,
                    undefined,
                  ),
                );
              }
            },
          };
        },
      );

      return {
        id: `chat-category-${category.id}`,
        name: categoryTranslation,
        disabled: () => false,
        text: categoryTranslation,
        color: categoryColor,
        _action: () => {}, // Empty action placeholder for RadialMenu
        subMenu: () => phraseItems,
      };
    });
  }

  shortenText(text: string, maxLength = 15): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + "...";
  }

  createFavoritesMenu(): MenuElement[] {
    const favorites = this.userSettings.getQuickChatFavorites();
    const sortedFavorites = [...favorites].sort((a, b) => a.order - b.order);

    const menuItems: MenuElement[] = [];

    sortedFavorites.forEach((favorite, index) => {
      const phrase = quickChatPhrases[favorite.category]?.find(
        (p) => p.key === favorite.key,
      );

      if (!phrase) {
        console.warn(`Favorite phrase not found: ${favorite.category}.${favorite.key}`);
        return;
      }

      const phraseText = translateText(`chat.${favorite.category}.${favorite.key}`);
      const categoryColor =
        COLORS.chat[favorite.category as keyof typeof COLORS.chat] ||
        COLORS.chat.default;

      menuItems.push({
        id: `favorite-${favorite.category}-${favorite.key}`,
        name: phraseText,
        disabled: () => false,
        text: this.shortenText(phraseText, 20),
        fontSize: "11px",
        color: categoryColor,
        tooltipItems: [
          {
            text: phraseText,
            className: "description",
          },
          {
            text: `Shortcut: ${index + 1}`,
            className: "cost",
          },
        ],
        action: (params: MenuElementParams) => {
          const myPlayer = params.game.myPlayer();
          if (!myPlayer) return;

          if (phrase.requiresPlayer) {
            // If requires player, enter selection mode
            // User will right-click a player to select recipient
            params.eventBus.emit(
              new QuickChatSelectionModeEvent(favorite, phrase),
            );
            params.closeMenu();
          } else {
            // No player required - send to all players immediately
            const players = params.game
              .players()
              .filter((p) => p.isAlive() && p.data.playerType !== PlayerType.Bot);
            
            players.forEach((player) => {
              params.eventBus.emit(
                new SendQuickChatEvent(
                  player,
                  `${favorite.category}.${favorite.key}`,
                  undefined,
                ),
              );
            });
            params.closeMenu();
          }
        },
      });
    });

    return menuItems;
  }
}
