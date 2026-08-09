import React from 'react';
import { Spinner, SpinnerSize } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';
export type ButtonSize = 'sm' | 'md';

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  // 'primary' = #EC7B38 orange (ConfirmDialog's existing 'primary' convention -- CTAs like
  // MasterDataTable's "Add X"), 'secondary' = #143358 navy (the main form-submit CTA on every
  // Auth/ProfileSetup screen and most Admin "Save" buttons), 'danger' = red-600 (destructive /
  // reject actions). Defaults to 'secondary' since that's the most common call site.
  variant?: ButtonVariant;
  // 'md' (default) = the full-width Auth/ProfileSetup submit shape (py-3, text-sm, shadow-md).
  // 'sm' = the compact Admin-screen shape (px-4 py-2, text-xs).
  size?: ButtonSize;
  isLoading?: boolean;
  // Replaces `children` while isLoading (e.g. "Saving..." instead of "Save"). Omit to keep
  // showing the same label while loading, just with the spinner swapped in for `icon`.
  loadingText?: React.ReactNode;
  // Leading icon, shown left of the label. Replaced by a Spinner while isLoading (this is the
  // "disabled + spinner-or-label" logic every one of these buttons hand-rolled).
  icon?: React.ReactNode;
  // Trailing icon (e.g. Auth pages' ArrowRight). Hidden while isLoading, same as the icon was.
  trailingIcon?: React.ReactNode;
  fullWidth?: boolean;
  children: React.ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-[#EC7B38] hover:bg-[#EC7B38]/90 text-white shadow-[#EC7B38]/30',
  secondary: 'bg-[#143358] hover:bg-[#143358]/90 text-white',
  danger: 'bg-red-600 hover:bg-red-600/90 text-white',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-xs',
  md: 'py-3 px-4 text-sm shadow-md',
};

const SPINNER_SIZE: Record<ButtonSize, SpinnerSize> = {
  sm: 'sm',
  md: 'md',
};

// Wraps the "disabled while submitting + spinner-or-icon + label" button pattern that was
// copy-pasted (identical Tailwind classes, identical isSubmitting ? <Loader2 .../> : <Icon />
// shape) across LoginPage, SignUpPage, StudentProfileForm, TutorProfileForm, SupportUserCreation
// and RoleVisibilityManager's Save button. Not every button in the app is meant to become a
// <Button> -- e.g. Navbar's nav-tab buttons have unique active-state styling that doesn't fit a
// generic variant, and MasterDataTable's Save/Cancel/Add buttons were left as-is since that file
// was very recently and carefully retrofitted with tests pinned to its exact structure.
export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  isLoading = false,
  loadingText,
  icon,
  trailingIcon,
  fullWidth = false,
  disabled,
  className,
  children,
  ...rest
}) => (
  <button
    {...rest}
    disabled={disabled || isLoading}
    className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
      VARIANT_CLASSES[variant]
    } ${SIZE_CLASSES[size]} ${fullWidth ? 'w-full' : ''} ${className ?? ''}`}
  >
    {isLoading ? <Spinner size={SPINNER_SIZE[size]} /> : icon}
    <span>{isLoading && loadingText ? loadingText : children}</span>
    {!isLoading && trailingIcon}
  </button>
);
