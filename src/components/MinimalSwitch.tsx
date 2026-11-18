import React from "react";

interface MinimalSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}

export const MinimalSwitch: React.FC<MinimalSwitchProps> = ({
  checked,
  onChange,
  label,
  description,
}) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-3 py-2 text-left group focus:outline-none"
    >
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-slate-100 group-hover:text-white transition-colors">
          {label}
        </div>
        {description && (
          <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
            {description}
          </div>
        )}
      </div>

      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 border ${
          checked
            ? "bg-[#0A84FF] border-white/25"
            : "bg-white/12 border-white/15"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? "translate-x-[18px]" : "translate-x-[2px]"
          }`}
        />
      </span>
    </button>
  );
};
