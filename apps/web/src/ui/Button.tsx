import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' };

export function Button({ variant = 'ghost', className, type = 'button', ...rest }: Props) {
  return <button type={type} className={`btn btn-${variant}${className ? ' ' + className : ''}`} {...rest} />;
}
