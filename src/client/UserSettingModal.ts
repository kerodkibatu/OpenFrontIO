import { LitElement, html } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { translateText } from "../client/Utils";
import { UserSettings } from "../core/game/UserSettings";
import { quickChatPhrases, QuickChatPhrase } from "./graphics/layers/ChatModal";
import "./components/baseComponents/setting/SettingKeybind";
import { SettingKeybind } from "./components/baseComponents/setting/SettingKeybind";
import "./components/baseComponents/setting/SettingNumber";
import "./components/baseComponents/setting/SettingSlider";
import "./components/baseComponents/setting/SettingToggle";

@customElement("user-setting")
export class UserSettingModal extends LitElement {
  private userSettings: UserSettings = new UserSettings();

  @state() private settingsMode: "basic" | "keybinds" | "favorites" = "basic";
  @state() private keybinds: Record<string, { value: string; key: string }> =
    {};

  @state() private keySequence: string[] = [];
  @state() private showEasterEggSettings = false;
  @state() private favorites: Array<{ category: string; key: string; order: number }> = [];
  @state() private draggedFavoriteIndex: number | null = null;
  @state() private lastRemovedFavorite: { category: string; key: string; order: number } | null = null;
  @state() private undoTimeout: ReturnType<typeof setTimeout> | null = null;

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("keydown", this.handleKeyDown);

    const savedKeybinds = localStorage.getItem("settings.keybinds");
    if (savedKeybinds) {
      try {
        this.keybinds = JSON.parse(savedKeybinds);
      } catch (e) {
        console.warn("Invalid keybinds JSON:", e);
      }
    }

    this.favorites = this.userSettings.getQuickChatFavorites();
  }

  @query("o-modal") private modalEl!: HTMLElement & {
    open: () => void;
    close: () => void;
    isModalOpen: boolean;
  };

  createRenderRoot() {
    return this;
  }

  disconnectedCallback() {
    window.removeEventListener("keydown", this.handleKeyDown);
    super.disconnectedCallback();
    document.body.style.overflow = "auto";
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (!this.modalEl?.isModalOpen || this.showEasterEggSettings) return;

    if (e.code === "Escape") {
      e.preventDefault();
      this.close();
    }

    const key = e.key.toLowerCase();
    const nextSequence = [...this.keySequence, key].slice(-4);
    this.keySequence = nextSequence;

    if (nextSequence.join("") === "evan") {
      this.triggerEasterEgg();
      this.keySequence = [];
    }
  };

  private triggerEasterEgg() {
    console.log("🪺 Setting~ unlocked by EVAN combo!");
    this.showEasterEggSettings = true;
    const popup = document.createElement("div");
    popup.className = "easter-egg-popup";
    popup.textContent = "🎉 You found a secret setting!";
    document.body.appendChild(popup);

    setTimeout(() => {
      popup.remove();
    }, 5000);
  }

  toggleDarkMode(e: CustomEvent<{ checked: boolean }>) {
    const enabled = e.detail?.checked;

    if (typeof enabled !== "boolean") {
      console.warn("Unexpected toggle event payload", e);
      return;
    }

    this.userSettings.set("settings.darkMode", enabled);

    if (enabled) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    this.dispatchEvent(
      new CustomEvent("dark-mode-changed", {
        detail: { darkMode: enabled },
        bubbles: true,
        composed: true,
      }),
    );

    console.log("🌙 Dark Mode:", enabled ? "ON" : "OFF");
  }

  private toggleEmojis(e: CustomEvent<{ checked: boolean }>) {
    const enabled = e.detail?.checked;
    if (typeof enabled !== "boolean") return;

    this.userSettings.set("settings.emojis", enabled);

    console.log("🤡 Emojis:", enabled ? "ON" : "OFF");
  }

  private toggleAlertFrame(e: CustomEvent<{ checked: boolean }>) {
    const enabled = e.detail?.checked;
    if (typeof enabled !== "boolean") return;

    this.userSettings.set("settings.alertFrame", enabled);

    console.log("🚨 Alert frame:", enabled ? "ON" : "OFF");
  }

  private toggleFxLayer(e: CustomEvent<{ checked: boolean }>) {
    const enabled = e.detail?.checked;
    if (typeof enabled !== "boolean") return;

    this.userSettings.set("settings.specialEffects", enabled);

    console.log("💥 Special effects:", enabled ? "ON" : "OFF");
  }

  private toggleStructureSprites(e: CustomEvent<{ checked: boolean }>) {
    const enabled = e.detail?.checked;
    if (typeof enabled !== "boolean") return;

    this.userSettings.set("settings.structureSprites", enabled);

    console.log("🏠 Structure sprites:", enabled ? "ON" : "OFF");
  }

  private toggleAnonymousNames(e: CustomEvent<{ checked: boolean }>) {
    const enabled = e.detail?.checked;
    if (typeof enabled !== "boolean") return;

    this.userSettings.set("settings.anonymousNames", enabled);

    console.log("🙈 Anonymous Names:", enabled ? "ON" : "OFF");
  }

  private toggleLobbyIdVisibility(e: CustomEvent<{ checked: boolean }>) {
    const hideIds = e.detail?.checked;
    if (typeof hideIds !== "boolean") return;

    this.userSettings.set("settings.lobbyIdVisibility", !hideIds); // Invert because checked=hide
    console.log("👁️ Hidden Lobby IDs:", hideIds ? "ON" : "OFF");
  }

  private toggleLeftClickOpensMenu(e: CustomEvent<{ checked: boolean }>) {
    const enabled = e.detail?.checked;
    if (typeof enabled !== "boolean") return;

    this.userSettings.set("settings.leftClickOpensMenu", enabled);
    console.log("🖱️ Left Click Opens Menu:", enabled ? "ON" : "OFF");

    this.requestUpdate();
  }

  private sliderAttackRatio(e: CustomEvent<{ value: number }>) {
    const value = e.detail?.value;
    if (typeof value === "number") {
      const ratio = value / 100;
      localStorage.setItem("settings.attackRatio", ratio.toString());
    } else {
      console.warn("Slider event missing detail.value", e);
    }
  }

  private sliderTroopRatio(e: CustomEvent<{ value: number }>) {
    const value = e.detail?.value;
    if (typeof value === "number") {
      const ratio = value / 100;
      localStorage.setItem("settings.troopRatio", ratio.toString());
    } else {
      console.warn("Slider event missing detail.value", e);
    }
  }

  private toggleTerritoryPatterns(e: CustomEvent<{ checked: boolean }>) {
    const enabled = e.detail?.checked;
    if (typeof enabled !== "boolean") return;

    this.userSettings.set("settings.territoryPatterns", enabled);

    console.log("🏳️ Territory Patterns:", enabled ? "ON" : "OFF");
  }

  private togglePerformanceOverlay(e: CustomEvent<{ checked: boolean }>) {
    const enabled = e.detail?.checked;
    if (typeof enabled !== "boolean") return;

    this.userSettings.set("settings.performanceOverlay", enabled);
  }

  private toggleQuickChatButton(e: CustomEvent<{ checked: boolean }>) {
    const enabled = e.detail?.checked;
    if (typeof enabled !== "boolean") return;

    this.userSettings.setQuickChatButtonVisible(enabled);
    console.log("💬 Quick Chat Button:", enabled ? "ON" : "OFF");
  }

  private handleKeybindChange(
    e: CustomEvent<{ action: string; value: string; key: string }>,
  ) {
    console.log("Keybind change event:", e);
    const { action, value, key } = e.detail;
    const prevValue = this.keybinds[action]?.value ?? "";

    const values = Object.entries(this.keybinds)
      .filter(([k]) => k !== action)
      .map(([, v]) => v.value);
    if (values.includes(value) && value !== "Null") {
      const popup = document.createElement("div");
      popup.className = "setting-popup";
      popup.textContent = `The key "${value}" is already assigned to another action.`;
      document.body.appendChild(popup);
      const element = this.renderRoot.querySelector(
        `setting-keybind[action="${action}"]`,
      ) as SettingKeybind;
      if (element) {
        element.value = prevValue;
        element.requestUpdate();
      }
      return;
    }
    this.keybinds = { ...this.keybinds, [action]: { value: value, key: key } };
    localStorage.setItem("settings.keybinds", JSON.stringify(this.keybinds));
  }

  render() {
    return html`
      <o-modal title="${translateText("user_setting.title")}">
        <div class="modal-overlay">
          <div class="modal-content user-setting-modal">
            <div class="flex mb-4 w-full justify-center">
              <button
                class="w-1/3 text-center px-2 py-1 rounded-l 
      ${this.settingsMode === "basic"
                  ? "bg-white/10 text-white"
                  : "bg-transparent text-gray-400"}"
                @click=${() => (this.settingsMode = "basic")}
              >
                ${translateText("user_setting.tab_basic")}
              </button>
              <button
                class="w-1/3 text-center px-2 py-1 rounded-none border-x border-gray-600
      ${this.settingsMode === "keybinds"
                  ? "bg-white/10 text-white"
                  : "bg-transparent text-gray-400"}"
                @click=${() => (this.settingsMode = "keybinds")}
              >
                ${translateText("user_setting.tab_keybinds")}
              </button>
              <button
                class="w-1/3 text-center px-2 py-1 rounded-r 
      ${this.settingsMode === "favorites"
                  ? "bg-white/10 text-white"
                  : "bg-transparent text-gray-400"}"
                @click=${() => (this.settingsMode = "favorites")}
              >
                ${translateText("user_setting.tab_favorites")}
              </button>
            </div>

            <div class="settings-list">
              ${this.settingsMode === "basic"
                ? this.renderBasicSettings()
                : this.settingsMode === "keybinds"
                  ? this.renderKeybindSettings()
                  : this.renderFavoritesSettings()}
            </div>
          </div>
        </div>
      </o-modal>
    `;
  }

  private renderBasicSettings() {
    return html`
      <!-- 🌙 Dark Mode -->
      <setting-toggle
        label="${translateText("user_setting.dark_mode_label")}"
        description="${translateText("user_setting.dark_mode_desc")}"
        id="dark-mode-toggle"
        .checked=${this.userSettings.darkMode()}
        @change=${(e: CustomEvent<{ checked: boolean }>) =>
          this.toggleDarkMode(e)}
      ></setting-toggle>

      <!-- 😊 Emojis -->
      <setting-toggle
        label="${translateText("user_setting.emojis_label")}"
        description="${translateText("user_setting.emojis_desc")}"
        id="emoji-toggle"
        .checked=${this.userSettings.emojis()}
        @change=${this.toggleEmojis}
      ></setting-toggle>

      <!-- 🚨 Alert frame -->
      <setting-toggle
        label="${translateText("user_setting.alert_frame_label")}"
        description="${translateText("user_setting.alert_frame_desc")}"
        id="alert-frame-toggle"
        .checked=${this.userSettings.alertFrame()}
        @change=${this.toggleAlertFrame}
      ></setting-toggle>

      <!-- 💥 Special effects -->
      <setting-toggle
        label="${translateText("user_setting.special_effects_label")}"
        description="${translateText("user_setting.special_effects_desc")}"
        id="special-effect-toggle"
        .checked=${this.userSettings.fxLayer()}
        @change=${this.toggleFxLayer}
      ></setting-toggle>

      <!-- 🏠 Structure Sprites -->
      <setting-toggle
        label="${translateText("user_setting.structure_sprites_label")}"
        description="${translateText("user_setting.structure_sprites_desc")}"
        id="structure_sprites-toggle"
        .checked=${this.userSettings.structureSprites()}
        @change=${this.toggleStructureSprites}
      ></setting-toggle>

      <!-- 🖱️ Left Click Menu -->
      <setting-toggle
        label="${translateText("user_setting.left_click_label")}"
        description="${translateText("user_setting.left_click_desc")}"
        id="left-click-toggle"
        .checked=${this.userSettings.leftClickOpensMenu()}
        @change=${this.toggleLeftClickOpensMenu}
      ></setting-toggle>

      <!-- 🙈 Anonymous Names -->
      <setting-toggle
        label="${translateText("user_setting.anonymous_names_label")}"
        description="${translateText("user_setting.anonymous_names_desc")}"
        id="anonymous-names-toggle"
        .checked=${this.userSettings.anonymousNames()}
        @change=${this.toggleAnonymousNames}
      ></setting-toggle>

      <!-- 👁️ Hidden Lobby IDs -->
      <setting-toggle
        label="${translateText("user_setting.lobby_id_visibility_label")}"
        description="${translateText("user_setting.lobby_id_visibility_desc")}"
        id="lobby-id-visibility-toggle"
        .checked=${!this.userSettings.get("settings.lobbyIdVisibility", true)}
        @change=${this.toggleLobbyIdVisibility}
      ></setting-toggle>

      <!-- 🏳️ Territory Patterns -->
      <setting-toggle
        label="${translateText("user_setting.territory_patterns_label")}"
        description="${translateText("user_setting.territory_patterns_desc")}"
        id="territory-patterns-toggle"
        .checked=${this.userSettings.territoryPatterns()}
        @change=${this.toggleTerritoryPatterns}
      ></setting-toggle>

      <!-- 📱 Performance Overlay -->
      <setting-toggle
        label="${translateText("user_setting.performance_overlay_label")}"
        description="${translateText("user_setting.performance_overlay_desc")}"
        id="performance-overlay-toggle"
        .checked=${this.userSettings.performanceOverlay()}
        @change=${this.togglePerformanceOverlay}
      ></setting-toggle>

      <!-- 💬 Quick Chat Button -->
      <setting-toggle
        label="${translateText("user_setting.quick_chat_button_label")}"
        description="${translateText("user_setting.quick_chat_button_desc")}"
        id="quick-chat-button-toggle"
        .checked=${this.userSettings.quickChatButtonVisible()}
        @change=${this.toggleQuickChatButton}
      ></setting-toggle>

      <!-- ⚔️ Attack Ratio -->
      <setting-slider
        label="${translateText("user_setting.attack_ratio_label")}"
        description="${translateText("user_setting.attack_ratio_desc")}"
        min="1"
        max="100"
        .value=${Number(localStorage.getItem("settings.attackRatio") ?? "0.2") *
        100}
        @change=${this.sliderAttackRatio}
      ></setting-slider>

      ${this.showEasterEggSettings
        ? html`
            <setting-slider
              label="${translateText(
                "user_setting.easter_writing_speed_label",
              )}"
              description="${translateText(
                "user_setting.easter_writing_speed_desc",
              )}"
              min="0"
              max="100"
              value="40"
              easter="true"
              @change=${(e: CustomEvent) => {
                const value = e.detail?.value;
                if (value !== undefined) {
                  console.log("Changed:", value);
                } else {
                  console.warn("Slider event missing detail.value", e);
                }
              }}
            ></setting-slider>

            <setting-number
              label="${translateText("user_setting.easter_bug_count_label")}"
              description="${translateText(
                "user_setting.easter_bug_count_desc",
              )}"
              value="100"
              min="0"
              max="1000"
              easter="true"
              @change=${(e: CustomEvent) => {
                const value = e.detail?.value;
                if (value !== undefined) {
                  console.log("Changed:", value);
                } else {
                  console.warn("Slider event missing detail.value", e);
                }
              }}
            ></setting-number>
          `
        : null}
    `;
  }

  private renderKeybindSettings() {
    return html`
      <div class="text-center text-white text-base font-semibold mt-5 mb-2">
        ${translateText("user_setting.view_options")}
      </div>

      <setting-keybind
        action="toggleView"
        label=${translateText("user_setting.toggle_view")}
        description=${translateText("user_setting.toggle_view_desc")}
        defaultKey="Space"
        .value=${this.keybinds["toggleView"]?.key ?? ""}
        @change=${this.handleKeybindChange}
      ></setting-keybind>

      <div class="text-center text-white text-base font-semibold mt-5 mb-2">
        ${translateText("user_setting.build_controls")}
      </div>

      <setting-keybind
        action="buildCity"
        label=${translateText("user_setting.build_city")}
        description=${translateText("user_setting.build_city_desc")}
        defaultKey="Digit1"
        .value=${this.keybinds["buildCity"]?.key ?? ""}
        @change=${this.handleKeybindChange}
      ></setting-keybind>

      <setting-keybind
        action="buildFactory"
        label=${translateText("user_setting.build_factory")}
        description=${translateText("user_setting.build_factory_desc")}
        defaultKey="Digit2"
        .value=${this.keybinds["buildFactory"]?.key ?? ""}
        @change=${this.handleKeybindChange}
      ></setting-keybind>

      <setting-keybind
        action="buildPort"
        label=${translateText("user_setting.build_port")}
        description=${translateText("user_setting.build_port_desc")}
        defaultKey="Digit3"
        .value=${this.keybinds["buildPort"]?.key ?? ""}
        @change=${this.handleKeybindChange}
      ></setting-keybind>

      <setting-keybind
        action="buildDefensePost"
        label=${translateText("user_setting.build_defense_post")}
        description=${translateText("user_setting.build_defense_post_desc")}
        defaultKey="Digit4"
        .value=${this.keybinds["buildDefensePost"]?.key ?? ""}
        @change=${this.handleKeybindChange}
      ></setting-keybind>

      <setting-keybind
        action="buildMissileSilo"
        label=${translateText("user_setting.build_missile_silo")}
        description=${translateText("user_setting.build_missile_silo_desc")}
        defaultKey="Digit5"
        .value=${this.keybinds["buildMissileSilo"]?.key ?? ""}
        @change=${this.handleKeybindChange}
      ></setting-keybind>

      <setting-keybind
        action="buildSamLauncher"
        label=${translateText("user_setting.build_sam_launcher")}
        description=${translateText("user_setting.build_sam_launcher_desc")}
        defaultKey="Digit6"
        .value=${this.keybinds["buildSamLauncher"]?.key ?? ""}
        @change=${this.handleKeybindChange}
      ></setting-keybind>

      <setting-keybind
        action="buildWarship"
        label=${translateText("user_setting.build_warship")}
        description=${translateText("user_setting.build_warship_desc")}
        defaultKey="Digit7"
        .value=${this.keybinds["buildWarship"]?.key ?? ""}
        @change=${this.handleKeybindChange}
      ></setting-keybind>

      <setting-keybind
        action="buildAtomBomb"
        label=${translateText("user_setting.build_atom_bomb")}
        description=${translateText("user_setting.build_atom_bomb_desc")}
        defaultKey="Digit8"
        .value=${this.keybinds["buildAtomBomb"]?.key ?? ""}
        @change=${this.handleKeybindChange}
      ></setting-keybind>

      <setting-keybind
        action="buildHydrogenBomb"
        label=${translateText("user_setting.build_hydrogen_bomb")}
        description=${translateText("user_setting.build_hydrogen_bomb_desc")}
        defaultKey="Digit9"
        .value=${this.keybinds["buildHydrogenBomb"]?.key ?? ""}
        @change=${this.handleKeybindChange}
      ></setting-keybind>

      <setting-keybind
        action="buildMIRV"
        label=${translateText("user_setting.build_mirv")}
        description=${translateText("user_setting.build_mirv_desc")}
        defaultKey="Digit0"
        .value=${this.keybinds["buildMIRV"]?.key ?? ""}
        @change=${this.handleKeybindChange}
      ></setting-keybind>

      <div class="text-center text-white text-base font-semibold mt-5 mb-2">
        ${translateText("user_setting.attack_ratio_controls")}
      </div>

      <setting-keybind
        action="attackRatioDown"
        label=${translateText("user_setting.attack_ratio_down")}
        description=${translateText("user_setting.attack_ratio_down_desc")}
        defaultKey="KeyT"
        .value=${this.keybinds["attackRatioDown"]?.key ?? ""}
        @change=${this.handleKeybindChange}
      ></setting-keybind>

      <setting-keybind
        action="attackRatioUp"
        label=${translateText("user_setting.attack_ratio_up")}
        description=${translateText("user_setting.attack_ratio_up_desc")}
        defaultKey="KeyY"
        .value=${this.keybinds["attackRatioUp"]?.key ?? ""}
        @change=${this.handleKeybindChange}
      ></setting-keybind>

      <div class="text-center text-white text-base font-semibold mt-5 mb-2">
        ${translateText("user_setting.attack_keybinds")}
      </div>

      <setting-keybind
        action="boatAttack"
        label=${translateText("user_setting.boat_attack")}
        description=${translateText("user_setting.boat_attack_desc")}
        defaultKey="KeyB"
        .value=${this.keybinds["boatAttack"]?.key ?? ""}
        @change=${this.handleKeybindChange}
      ></setting-keybind>

      <setting-keybind
        action="groundAttack"
        label=${translateText("user_setting.ground_attack")}
        description=${translateText("user_setting.ground_attack_desc")}
        defaultKey="KeyG"
        .value=${this.keybinds["groundAttack"]?.key ?? ""}
        @change=${this.handleKeybindChange}
      ></setting-keybind>

      <div class="text-center text-white text-base font-semibold mt-5 mb-2">
        ${translateText("user_setting.zoom_controls")}
      </div>

      <setting-keybind
        action="zoomOut"
        label=${translateText("user_setting.zoom_out")}
        description=${translateText("user_setting.zoom_out_desc")}
        defaultKey="KeyQ"
        .value=${this.keybinds["zoomOut"]?.key ?? ""}
        @change=${this.handleKeybindChange}
      ></setting-keybind>

      <setting-keybind
        action="zoomIn"
        label=${translateText("user_setting.zoom_in")}
        description=${translateText("user_setting.zoom_in_desc")}
        defaultKey="KeyE"
        .value=${this.keybinds["zoomIn"]?.key ?? ""}
        @change=${this.handleKeybindChange}
      ></setting-keybind>

      <div class="text-center text-white text-base font-semibold mt-5 mb-2">
        ${translateText("user_setting.camera_movement")}
      </div>

      <setting-keybind
        action="centerCamera"
        label=${translateText("user_setting.center_camera")}
        description=${translateText("user_setting.center_camera_desc")}
        defaultKey="KeyC"
        .value=${this.keybinds["centerCamera"]?.key ?? ""}
        @change=${this.handleKeybindChange}
      ></setting-keybind>

      <setting-keybind
        action="moveUp"
        label=${translateText("user_setting.move_up")}
        description=${translateText("user_setting.move_up_desc")}
        defaultKey="KeyW"
        .value=${this.keybinds["moveUp"]?.key ?? ""}
        @change=${this.handleKeybindChange}
      ></setting-keybind>

      <setting-keybind
        action="moveLeft"
        label=${translateText("user_setting.move_left")}
        description=${translateText("user_setting.move_left_desc")}
        defaultKey="KeyA"
        .value=${this.keybinds["moveLeft"]?.key ?? ""}
        @change=${this.handleKeybindChange}
      ></setting-keybind>

      <setting-keybind
        action="moveDown"
        label=${translateText("user_setting.move_down")}
        description=${translateText("user_setting.move_down_desc")}
        defaultKey="KeyS"
        .value=${this.keybinds["moveDown"]?.key ?? ""}
        @change=${this.handleKeybindChange}
      ></setting-keybind>

      <setting-keybind
        action="moveRight"
        label=${translateText("user_setting.move_right")}
        description=${translateText("user_setting.move_right_desc")}
        defaultKey="KeyD"
        .value=${this.keybinds["moveRight"]?.key ?? ""}
        @change=${this.handleKeybindChange}
      ></setting-keybind>
    `;
  }

  public open() {
    this.requestUpdate();
    this.modalEl?.open();
  }

  public close() {
    this.modalEl?.close();
  }

  private renderFavoritesSettings() {
    const sortedFavorites = [...this.favorites].sort((a, b) => a.order - b.order);
    const maxFavorites = 5;

    return html`
      <style>
        .favorites-container {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .favorites-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          min-height: 200px;
          padding: 1rem;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 0.5rem;
        }
        .favorite-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 0.25rem;
          cursor: move;
          transition: background 0.2s;
        }
        .favorite-item:hover {
          background: rgba(255, 255, 255, 0.15);
        }
        .favorite-item.dragging {
          opacity: 0.5;
        }
        .favorite-item .drag-handle {
          cursor: grab;
          user-select: none;
        }
        .favorite-item .drag-handle:active {
          cursor: grabbing;
        }
        .favorite-item .remove-btn {
          margin-left: auto;
          padding: 0.25rem 0.5rem;
          background: rgba(239, 68, 68, 0.7);
          border: none;
          border-radius: 0.25rem;
          color: white;
          cursor: pointer;
        }
        .favorite-item .remove-btn:hover {
          background: rgba(239, 68, 68, 0.9);
        }
        .message-selector {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 0.5rem;
          max-height: 300px;
          overflow-y: auto;
          padding: 1rem;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 0.5rem;
        }
        .message-button {
          padding: 0.5rem;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 0.25rem;
          color: white;
          cursor: pointer;
          text-align: left;
          transition: background 0.2s;
        }
        .message-button:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        .message-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .undo-notification {
          position: fixed;
          bottom: 2rem;
          left: 50%;
          transform: translateX(-50%);
          padding: 0.75rem 1.5rem;
          background: rgba(34, 197, 94, 0.9);
          color: white;
          border-radius: 0.5rem;
          z-index: 10000;
          display: flex;
          gap: 1rem;
          align-items: center;
        }
        .undo-notification button {
          padding: 0.25rem 0.75rem;
          background: white;
          color: rgba(34, 197, 94, 1);
          border: none;
          border-radius: 0.25rem;
          cursor: pointer;
          font-weight: bold;
        }
      </style>

      <div class="favorites-container">
        <div class="text-white text-base font-semibold mb-2">
          ${translateText("user_setting.favorites_title")} (${sortedFavorites.length}/${maxFavorites})
        </div>

        <div class="favorites-list">
          ${sortedFavorites.length === 0
            ? html`<div class="text-gray-400 text-center py-4">
                ${translateText("user_setting.favorites_empty")}
              </div>`
            : sortedFavorites.map(
                (fav, index) => html`
                  <div
                    class="favorite-item ${this.draggedFavoriteIndex === index ? "dragging" : ""}"
                    draggable="true"
                    @dragstart=${(e: DragEvent) => this.handleDragStart(e, index)}
                    @dragover=${(e: DragEvent) => this.handleDragOver(e)}
                    @drop=${(e: DragEvent) => this.handleDrop(e, index)}
                    @dragend=${() => (this.draggedFavoriteIndex = null)}
                  >
                    <span class="drag-handle">⋮⋮</span>
                    <span>${index + 1}.</span>
                    <span>${translateText(`chat.${fav.category}.${fav.key}`)}</span>
                    <span class="text-gray-400 text-sm">(${translateText(`chat.cat.${fav.category}`)})</span>
                    <button
                      class="remove-btn"
                      @click=${() => this.removeFavorite(index)}
                    >
                      ${translateText("user_setting.remove")}
                    </button>
                  </div>
                `,
              )}
        </div>

        ${sortedFavorites.length < maxFavorites
          ? html`
              <div class="text-white text-base font-semibold mb-2">
                ${translateText("user_setting.add_favorite")}
              </div>
              <div class="message-selector">
                ${Object.entries(quickChatPhrases).map(([category, phrases]) =>
                  phrases.map((phrase: QuickChatPhrase) => {
                    const isFavorite = sortedFavorites.some(
                      (f) => f.category === category && f.key === phrase.key,
                    );
                    return html`
                      <button
                        class="message-button"
                        ?disabled=${isFavorite}
                        @click=${() => this.addFavorite(category, phrase.key)}
                      >
                        ${translateText(`chat.${category}.${phrase.key}`)}
                        <div class="text-xs text-gray-400 mt-1">
                          ${translateText(`chat.cat.${category}`)}
                        </div>
                      </button>
                    `;
                  }),
                )}
              </div>
            `
          : html`<div class="text-gray-400 text-center py-2">
              ${translateText("user_setting.favorites_max")}
            </div>`}

        ${this.lastRemovedFavorite && this.undoTimeout
          ? html`
              <div class="undo-notification">
                <span>${translateText("user_setting.favorite_removed")}</span>
                <button @click=${this.undoRemoveFavorite}>
                  ${translateText("user_setting.undo")}
                </button>
              </div>
            `
          : null}
      </div>
    `;
  }

  private handleDragStart(e: DragEvent, index: number) {
    this.draggedFavoriteIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", index.toString());
    }
  }

  private handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
  }

  private handleDrop(e: DragEvent, targetIndex: number) {
    e.preventDefault();
    if (this.draggedFavoriteIndex === null) return;

    const draggedIndex = this.draggedFavoriteIndex;
    if (draggedIndex === targetIndex) return;

    const sortedFavorites = [...this.favorites].sort((a, b) => a.order - b.order);
    const draggedItem = sortedFavorites[draggedIndex];
    const targetItem = sortedFavorites[targetIndex];

    if (!draggedItem || !targetItem) return;

    // Swap orders
    const tempOrder = draggedItem.order;
    draggedItem.order = targetItem.order;
    targetItem.order = tempOrder;

    // Update favorites array
    this.favorites = this.favorites.map((f) => {
      if (f.category === draggedItem.category && f.key === draggedItem.key) {
        return { ...f, order: targetItem.order };
      }
      if (f.category === targetItem.category && f.key === targetItem.key) {
        return { ...f, order: tempOrder };
      }
      return f;
    });

    this.userSettings.setQuickChatFavorites(this.favorites);
    this.draggedFavoriteIndex = null;
    this.requestUpdate();
  }

  private addFavorite(category: string, key: string) {
    if (this.favorites.length >= 5) return;

    const isDuplicate = this.favorites.some(
      (f) => f.category === category && f.key === key,
    );
    if (isDuplicate) return;

    const newFavorite = {
      category,
      key,
      order: this.favorites.length,
    };

    this.favorites = [...this.favorites, newFavorite];
    this.userSettings.setQuickChatFavorites(this.favorites);
  }

  private removeFavorite(index: number) {
    const sortedFavorites = [...this.favorites].sort((a, b) => a.order - b.order);
    const favoriteToRemove = sortedFavorites[index];

    if (this.undoTimeout) {
      clearTimeout(this.undoTimeout);
    }

    this.lastRemovedFavorite = favoriteToRemove;
    this.favorites = this.favorites.filter(
      (f) => !(f.category === favoriteToRemove.category && f.key === favoriteToRemove.key),
    );

    // Reorder remaining favorites
    this.favorites = this.favorites.map((f, i) => ({ ...f, order: i }));
    this.userSettings.setQuickChatFavorites(this.favorites);

    // Set undo timeout (5 seconds)
    this.undoTimeout = setTimeout(() => {
      this.lastRemovedFavorite = null;
      this.undoTimeout = null;
      this.requestUpdate();
    }, 5000);

    this.requestUpdate();
  }

  private undoRemoveFavorite = () => {
    if (!this.lastRemovedFavorite) return;

    this.favorites = [...this.favorites, this.lastRemovedFavorite];
    this.favorites = this.favorites.map((f, i) => ({ ...f, order: i }));
    this.userSettings.setQuickChatFavorites(this.favorites);

    if (this.undoTimeout) {
      clearTimeout(this.undoTimeout);
      this.undoTimeout = null;
    }

    this.lastRemovedFavorite = null;
    this.requestUpdate();
  };
}
