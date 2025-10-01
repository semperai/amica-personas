import Link from 'next/link';

interface ButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  external?: boolean;
  className?: string;
}

export function Button({ href, children, variant = 'primary', external = false, className = '' }: ButtonProps) {
  const baseClasses = "inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors !no-underline hover:!no-underline";

  const variantClasses = {
    primary: "bg-brand-blue hover:bg-blue-500 !text-white",
    secondary: "bg-muted text-foreground hover:bg-muted/80"
  };

  const combinedClasses = `${baseClasses} ${variantClasses[variant]} ${className}`;

  const buttonStyle = {
    color: variant === 'primary' ? '#ffffff' : undefined,
    textDecoration: 'none'
  };

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={combinedClasses}
        style={buttonStyle}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={combinedClasses} style={buttonStyle}>
      {children}
    </Link>
  );
}
