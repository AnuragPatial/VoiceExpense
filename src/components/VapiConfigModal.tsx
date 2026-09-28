import React, { useState, useEffect } from 'react';
import { X, Key, ShieldCheck, ExternalLink, Copy, Check, Link2 } from 'lucide-react';

interface VapiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: {
    publicKey: string;
    assistantId: string;
  };
  onSave: (newConfig: { publicKey: string; assistantId: string }) => void;
}

export const VapiConfigModal: React.FC<VapiConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave
}) => {
  const [publicKey, setPublicKey] = useState(config.publicKey);
  const [assistantId, setAssistantId] = useState(config.assistantId);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  useEffect(() => {
    setPublicKey(config.publicKey);
    setAssistantId(config.assistantId);
  }, [config.publicKey, config.assistantId, isOpen]);

  if (!isOpen) return null;

  const webhookUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/api/vapi/tool` : '/api/vapi/tool';

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      publicKey: publicKey.trim(),
      assistantId: assistantId.trim()
    });
    onClose();
  };

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const assistantPrompt = `You are a voice-first personal expense tracking assistant.
Your job is to help the user record and understand their expenses.

You can:
* add expenses (addExpense)
* retrieve expenses (getExpenses)
* calculate spending summaries (getExpenseSummary)
* delete expenses (deleteExpense)

Always use the appropriate tool when the user asks you to modify or retrieve expense data.
Keep voice responses short and conversational.
After successfully adding an expense, confirm: amount, description, and category.
Example: "Done. I recorded ₹450 for dinner under Food."`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative my-8">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Vapi Voice AI Configuration</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-xl flex items-start gap-2.5 text-xs text-neutral-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Enter your <strong>Vapi Public Key</strong> below (or via <code>VITE_VAPI_PUBLIC_KEY</code> in environment variables). You can optionally provide a custom <strong>Assistant ID</strong>, or leave it blank to use the built-in auto-configured VoiceExpense assistant.
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              Vapi Public Key <span className="text-emerald-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 4b7a1c2d-3e4f-5a6b-7c8d-9e0f1a2b3c4d"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
            <p className="text-[11px] text-neutral-400 mt-1">
              Found in Vapi Dashboard &rarr; Organization Settings &rarr; API Keys &rarr; Public Key.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              Vapi Assistant ID <span className="text-neutral-500">(Optional — leave empty for Auto-Configured Assistant)</span>
            </label>
            <input
              type="text"
              placeholder="Optional: e.g. 9f8e7d6c-... (leave blank to auto-configure tools)"
              value={assistantId}
              onChange={(e) => setAssistantId(e.target.value)}
              className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
            <p className="text-[11px] text-neutral-400 mt-1">
              If left blank, VoiceExpense automatically configures the voice assistant and all 4 expense tools for you.
            </p>
          </div>

          {/* Webhook Server URL for Vapi Dashboard */}
          <div className="border-t border-neutral-800 pt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
                <Link2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Backend Tool / Server URL (for Vapi Dashboard)</span>
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(webhookUrl, 'webhook')}
                className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 cursor-pointer"
              >
                {copiedSection === 'webhook' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedSection === 'webhook' ? 'Copied' : 'Copy URL'}</span>
              </button>
            </div>
            <div className="px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-[11px] font-mono text-emerald-300 break-all">
              {webhookUrl}
            </div>
          </div>

          {/* Quick Assistant System Prompt Reference */}
          <div className="border-t border-neutral-800 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-300">Recommended Assistant Instructions</span>
              <button
                type="button"
                onClick={() => copyToClipboard(assistantPrompt, 'prompt')}
                className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 cursor-pointer"
              >
                {copiedSection === 'prompt' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedSection === 'prompt' ? 'Copied' : 'Copy Prompt'}</span>
              </button>
            </div>
            <pre className="text-[11px] bg-neutral-950 p-3 rounded-lg text-neutral-400 font-mono max-h-28 overflow-y-auto whitespace-pre-wrap leading-relaxed border border-neutral-800">
              {assistantPrompt}
            </pre>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-neutral-800">
            <a
              href="https://dashboard.vapi.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200"
            >
              <span>Vapi Dashboard</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs text-neutral-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VapiConfigModal;
