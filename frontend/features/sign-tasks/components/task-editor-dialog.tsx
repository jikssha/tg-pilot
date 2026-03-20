"use client";

import {
  ArrowClockwise,
  CaretDown,
  DotsThreeVertical,
  Hash,
  Lightning,
  MagnifyingGlass,
  MathOperations,
  Plus,
  Robot,
  Spinner,
  Timer,
  Trash,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import { ChatInfo } from "@/lib/api";

type ActionTypeOption = "1" | "2" | "3" | "ai_vision" | "ai_logic";

interface TaskEditorDialogProps {
  open: boolean;
  mode: "create" | "edit";
  loading: boolean;
  title: string;
  subtitle: string;
  t: (key: string) => string;
  fieldLabelClass: string;
  taskNamePlaceholder: string;
  sendTextLabel: string;
  clickTextButtonLabel: string;
  sendDiceLabel: string;
  aiVisionLabel: string;
  aiCalcLabel: string;
  aiVisionSendModeLabel: string;
  aiVisionClickModeLabel: string;
  aiCalcSendModeLabel: string;
  aiCalcClickModeLabel: string;
  sendTextPlaceholder: string;
  clickButtonPlaceholder: string;
  chats: ChatInfo[];
  chatSearch: string;
  chatSearchResults: ChatInfo[];
  chatSearchLoading: boolean;
  refreshingChats: boolean;
  taskName: string;
  executionMode: "fixed" | "range";
  fixedTime: string;
  rangeStart: string;
  rangeEnd: string;
  actionInterval: number;
  chatId: number;
  chatIdManual: string;
  deleteAfter?: number;
  actions: any[];
  onClose: () => void;
  onTaskNameChange: (value: string) => void;
  onExecutionModeChange: (value: "fixed" | "range") => void;
  onActionIntervalChange: (value: number) => void;
  onFixedTimeChange: (value: string) => void;
  onRangeStartChange: (value: string) => void;
  onRangeEndChange: (value: string) => void;
  onChatSearchChange: (value: string) => void;
  onSelectChat: (chatId: number, chatName: string) => void;
  onRefreshChats: () => void;
  onChatIdManualChange: (value: string) => void;
  onDeleteAfterChange: (value?: number) => void;
  onAddAction: () => void;
  onRemoveAction: (index: number) => void;
  onUpdateAction: (index: number, updater: (action: any) => any) => void;
  onSubmit: () => void;
}

const DICE_OPTIONS = ["🎲", "🎯", "🏀", "⚽", "🎳", "🎰"] as const;

const toActionTypeOption = (action: any): ActionTypeOption => {
  const actionId = Number(action?.action);
  if (actionId === 2) return "2";
  if (actionId === 3) return "3";
  if (actionId === 4 || actionId === 6) return "ai_vision";
  if (actionId === 5 || actionId === 7) return "ai_logic";
  return "1";
};

export function TaskEditorDialog({
  open,
  mode,
  loading,
  title,
  subtitle,
  t,
  fieldLabelClass,
  taskNamePlaceholder,
  sendTextLabel,
  clickTextButtonLabel,
  sendDiceLabel,
  aiVisionLabel,
  aiCalcLabel,
  aiVisionSendModeLabel,
  aiVisionClickModeLabel,
  aiCalcSendModeLabel,
  aiCalcClickModeLabel,
  sendTextPlaceholder,
  clickButtonPlaceholder,
  chats,
  chatSearch,
  chatSearchResults,
  chatSearchLoading,
  refreshingChats,
  taskName,
  executionMode,
  fixedTime,
  rangeStart,
  rangeEnd,
  actionInterval,
  chatId,
  chatIdManual,
  deleteAfter,
  actions,
  onClose,
  onTaskNameChange,
  onExecutionModeChange,
  onActionIntervalChange,
  onFixedTimeChange,
  onRangeStartChange,
  onRangeEndChange,
  onChatSearchChange,
  onSelectChat,
  onRefreshChats,
  onChatIdManualChange,
  onDeleteAfterChange,
  onAddAction,
  onRemoveAction,
  onUpdateAction,
  onSubmit,
}: TaskEditorDialogProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div
        className="glass-panel modal-content !max-w-2xl !p-0 overflow-hidden animate-zoom-in border-white/5 flex flex-col !h-[85vh] shadow-[0_0_50px_rgba(0,0,0,0.5)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-glow)]/10 border border-[var(--accent-glow)]/30 flex items-center justify-center text-[#b57dff] shadow-inner">
              <Lightning weight="fill" size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">{title}</h3>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mt-0.5 font-bold">{subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="icon-btn !w-9 !h-9 bg-white/[0.03] hover:bg-white/[0.08]">
            <X weight="bold" size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-black/10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="task-name-input" className={fieldLabelClass}>
                {t("task_name")}
              </label>
              <input
                id="task-name-input"
                className="!mb-0"
                placeholder={taskNamePlaceholder}
                value={taskName}
                onChange={(event) => onTaskNameChange(event.target.value)}
                readOnly={mode === "edit"}
                aria-readonly={mode === "edit"}
              />
            </div>

            <div className="space-y-2">
              <label className={fieldLabelClass}>{t("scheduling_mode")}</label>
              <select className="w-full" value={executionMode} onChange={(event) => onExecutionModeChange(event.target.value as "fixed" | "range")}>
                <option value="range">{t("random_range_recommend")}</option>
                <option value="fixed">{t("fixed_time_cron")}</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className={fieldLabelClass}>{t("action_interval")}</label>
              <input type="text" className="!mb-0" value={actionInterval} onChange={(event) => onActionIntervalChange(parseInt(event.target.value) || 1)} />
            </div>

            <div className="space-y-2">
              {executionMode === "fixed" ? (
                <>
                  <label className={fieldLabelClass}>{t("sign_time_cron")}</label>
                  <input
                    type="time"
                    step={60}
                    className="!mb-0 !w-full min-w-0"
                    aria-label={t("sign_time_cron")}
                    value={fixedTime}
                    onChange={(event) => onFixedTimeChange(event.target.value)}
                  />
                  <div className="text-[10px] text-main/30 mt-1 italic">{t("cron_example")}</div>
                </>
              ) : (
                <>
                  <label className={fieldLabelClass}>{t("time_range")}</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="time"
                      step={60}
                      className="!mb-0 !w-full min-w-0"
                      aria-label={t("start_label")}
                      title={t("start_label")}
                      value={rangeStart}
                      onChange={(event) => onRangeStartChange(event.target.value)}
                    />
                    <input
                      type="time"
                      step={60}
                      className="!mb-0 !w-full min-w-0"
                      aria-label={t("end_label")}
                      title={t("end_label")}
                      value={rangeEnd}
                      onChange={(event) => onRangeEndChange(event.target.value)}
                    />
                  </div>
                  <div className="text-[10px] text-main/30 mt-1 italic">{t("random_time_hint")}</div>
                </>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-6 space-y-6 shadow-inner">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-sky-500/10 rounded-lg text-sky-400">
                <MagnifyingGlass weight="bold" size={14} />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/50">{t("chat_target_config")}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] text-main/40 uppercase tracking-widest font-bold">{t("search_chat")}</label>
                <div className="relative group">
                  <input className="!mb-0 !h-11 bg-black/40 border-white/5 focus:border-sky-500/30 transition-all rounded-xl pl-10" placeholder={t("search_chat_placeholder")} value={chatSearch} onChange={(event) => onChatSearchChange(event.target.value)} />
                  <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-sky-400 transition-colors" size={16} weight="bold" />
                </div>
                {chatSearch.trim() ? (
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-white/5 bg-black/60 backdrop-blur-xl mt-2 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                    {chatSearchLoading ? (
                      <div className="px-3 py-2 text-xs text-main/40">{t("searching")}</div>
                    ) : chatSearchResults.length > 0 ? (
                      <div className="flex flex-col">
                        {chatSearchResults.map((chat) => {
                          const title = chat.title || chat.username || String(chat.id);
                          return (
                            <button key={chat.id} type="button" className="text-left px-3 py-2 hover:bg-white/5 border-b border-white/5 last:border-b-0" onClick={() => onSelectChat(chat.id, title)}>
                              <div className="text-sm font-semibold truncate">{title}</div>
                              <div className="text-[10px] text-main/40 font-mono truncate">{chat.id}{chat.username ? ` · @${chat.username}` : ""}</div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="px-3 py-2 text-xs text-main/40">{t("search_no_results")}</div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-main/40 uppercase tracking-widest font-bold">{t("select_from_list")}</label>
                  <button onClick={onRefreshChats} disabled={refreshingChats} className="text-[10px] text-sky-400 hover:text-sky-300 transition-colors uppercase font-black tracking-tighter flex items-center gap-1.5" title={t("refresh_chat_title")}>
                    {refreshingChats ? <div className="w-3 h-3 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" /> : <ArrowClockwise weight="bold" size={12} />}
                    {t("refresh_list")}
                  </button>
                </div>
                <div className="relative group">
                  <select
                    className="!mb-0 !h-11 bg-black/40 border-white/5 focus:border-sky-500/30 transition-all rounded-xl pl-10 appearance-none cursor-pointer pr-10"
                    value={chatId}
                    onChange={(event) => {
                      const id = parseInt(event.target.value);
                      const chat = chats.find((item) => item.id === id);
                      onSelectChat(id, chat?.title || chat?.username || "");
                    }}
                  >
                    <option value={0}>{t("select_from_list")}</option>
                    {chats.map((chat) => (
                      <option key={chat.id} value={chat.id}>{chat.title || chat.username || chat.id}</option>
                    ))}
                  </select>
                  <UsersThree className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-sky-400 transition-colors" size={16} weight="bold" />
                  <CaretDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" size={14} weight="bold" />
                </div>
              </div>

              <div className="space-y-2 group">
                <label className="text-[10px] text-main/40 uppercase tracking-widest font-bold">{t("manual_chat_id")}</label>
                <div className="relative">
                  <input placeholder={t("manual_id_placeholder")} className="!mb-0 !h-11 bg-black/40 border-white/5 focus:border-rose-500/30 transition-all rounded-xl pl-10" value={chatIdManual} onChange={(event) => onChatIdManualChange(event.target.value)} />
                  <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-rose-400 transition-colors" size={16} weight="bold" />
                </div>
              </div>

              <div className="space-y-2 group">
                <label className="text-[10px] text-main/40 uppercase tracking-widest font-bold">{t("delete_after")}</label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder={t("delete_after_placeholder")}
                    className="!mb-0 !h-11 bg-black/40 border-white/5 focus:border-amber-500/30 transition-all rounded-xl pl-10"
                    value={deleteAfter ?? ""}
                    onChange={(event) => {
                      const cleaned = event.target.value.replace(/[^0-9]/g, "");
                      onDeleteAfterChange(cleaned === "" ? undefined : Number(cleaned));
                    }}
                  />
                  <Timer className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-amber-400 transition-colors" size={16} weight="bold" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
                  <DotsThreeVertical weight="bold" size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight uppercase">{t("action_sequence")}</h3>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mt-0.5 font-bold">Automation Logic</p>
                </div>
              </div>
              <button onClick={onAddAction} className="h-10 px-5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
                <Plus weight="bold" /> {t("add_action")}
              </button>
            </div>

            <div className="space-y-3">
              {actions.map((action, index) => (
                <div key={index} className="flex gap-4 items-center bg-white/[0.02] border border-white/5 p-4 rounded-2xl group/action hover:bg-white/[0.03] hover:border-white/10 transition-all animate-zoom-in">
                  <div className="shrink-0 w-8 h-8 flex items-center justify-center font-mono text-[11px] text-white/10 font-black bg-black/20 rounded-lg group-hover/action:text-indigo-500/40 transition-colors">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="shrink-0 relative">
                    <select
                      className="!w-[150px] !h-10 !mb-0 !py-0 !text-[11px] font-bold bg-black/40 border-white/5 rounded-xl px-4 appearance-none cursor-pointer pr-10 focus:border-white/20"
                      value={toActionTypeOption(action)}
                      onChange={(event) => {
                        const selectedType = event.target.value as ActionTypeOption;
                        onUpdateAction(index, (currentAction) => {
                          const currentActionId = Number(currentAction?.action);
                          if (selectedType === "1") return { ...currentAction, action: 1, text: currentAction?.text || "" };
                          if (selectedType === "3") return { ...currentAction, action: 3, text: currentAction?.text || "" };
                          if (selectedType === "2") return { ...currentAction, action: 2, dice: currentAction?.dice || DICE_OPTIONS[0] };
                          if (selectedType === "ai_vision") {
                            const nextActionId = currentActionId === 4 || currentActionId === 6 ? currentActionId : 6;
                            return { ...currentAction, action: nextActionId };
                          }
                          const nextActionId = currentActionId === 5 || currentActionId === 7 ? currentActionId : 5;
                          return { ...currentAction, action: nextActionId };
                        });
                      }}
                    >
                      <option value="1">{sendTextLabel}</option>
                      <option value="3">{clickTextButtonLabel}</option>
                      <option value="2">{sendDiceLabel}</option>
                      <option value="ai_vision">{aiVisionLabel}</option>
                      <option value="ai_logic">{aiCalcLabel}</option>
                    </select>
                    <CaretDown className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" size={12} weight="bold" />
                  </div>

                  <div className="flex-1 min-w-0">
                    {(action.action === 1 || action.action === 3) ? (
                      <input
                        placeholder={action.action === 1 ? sendTextPlaceholder : clickButtonPlaceholder}
                        className="!mb-0 !h-10 !text-[11px] bg-black/40 border-white/5 rounded-xl px-5 focus:border-white/20 transition-all"
                        value={action.text || ""}
                        onChange={(event) => onUpdateAction(index, (currentAction) => ({ ...currentAction, text: event.target.value }))}
                      />
                    ) : null}
                    {action.action === 2 ? (
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                        {DICE_OPTIONS.map((dice) => (
                          <button
                            key={dice}
                            type="button"
                            className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-lg transition-all ${action?.dice === dice ? "bg-amber-500/20 border border-amber-500/40 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]" : "bg-black/40 border border-white/5 text-white/10 hover:text-white/40 hover:bg-white/5"}`}
                            onClick={() => onUpdateAction(index, (currentAction) => ({ ...currentAction, dice }))}
                          >
                            {dice}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {(action.action === 4 || action.action === 6) ? (
                      <div className="h-10 px-4 flex items-center gap-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                        <Robot weight="fill" size={18} className="text-[#8183ff] shrink-0" />
                        <select
                          className="!mb-0 !h-10 !py-0 !text-[11px] font-black uppercase tracking-widest bg-transparent border-none focus:ring-0 !w-full cursor-pointer"
                          value={action.action === 4 ? "click" : "send"}
                          onChange={(event) => onUpdateAction(index, (currentAction) => ({ ...currentAction, action: event.target.value === "click" ? 4 : 6 }))}
                        >
                          <option value="send">{aiVisionSendModeLabel}</option>
                          <option value="click">{aiVisionClickModeLabel}</option>
                        </select>
                      </div>
                    ) : null}
                    {(action.action === 5 || action.action === 7) ? (
                      <div className="h-10 px-4 flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                        <MathOperations weight="fill" size={18} className="text-amber-400 shrink-0" />
                        <select
                          className="!mb-0 !h-10 !py-0 !text-[11px] font-black uppercase tracking-widest bg-transparent border-none focus:ring-0 !w-full cursor-pointer"
                          value={action.action === 7 ? "click" : "send"}
                          onChange={(event) => onUpdateAction(index, (currentAction) => ({ ...currentAction, action: event.target.value === "click" ? 7 : 5 }))}
                        >
                          <option value="send">{aiCalcSendModeLabel}</option>
                          <option value="click">{aiCalcClickModeLabel}</option>
                        </select>
                      </div>
                    ) : null}
                  </div>

                  <button onClick={() => onRemoveAction(index)} className="w-10 h-10 rounded-xl text-rose-500/30 hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center transition-all opacity-0 group-hover/action:opacity-100">
                    <Trash weight="bold" size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <footer className="p-6 border-t border-white/5 flex gap-4 bg-white/[0.01]">
          <button className="linear-btn-secondary flex-1 h-12" onClick={onClose}>{t("cancel")}</button>
          <button className="linear-btn-primary flex-[2] h-12 font-black uppercase tracking-widest text-[13px] !bg-white !text-black shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-95" onClick={onSubmit} disabled={loading}>
            {loading ? <Spinner className="animate-spin text-black" /> : mode === "create" ? t("add_task") : t("save_changes")}
          </button>
        </footer>
      </div>
    </div>
  );
}
