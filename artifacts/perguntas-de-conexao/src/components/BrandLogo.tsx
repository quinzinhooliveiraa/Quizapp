import { Feather } from "lucide-react";
import { Link } from "wouter";

type BrandLogoProps = {
  inverse?: boolean;
  testId?: string;
  href?: string;
  onClick?: () => void;
};

export function BrandLogo({
  inverse = false,
  testId = "link-logo",
  href = "/",
  onClick,
}: BrandLogoProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      data-testid={testId}
      className={`brand-mark ${inverse ? "brand-mark-inverse" : ""}`}
    >
      <span className="brand-symbol">
        <Feather size={18} strokeWidth={1.6} />
      </span>
      <span>
        Perguntas
        <br />
        <i>de Conexão</i>
      </span>
    </Link>
  );
}

export function SiteFooter({
  logoTestId = "link-logo",
  logoHref = "/",
  onLogoClick,
}: {
  logoTestId?: string;
  logoHref?: string;
  onLogoClick?: () => void;
}) {
  return (
    <footer className="site-footer">
      <BrandLogo
        inverse
        testId={logoTestId}
        href={logoHref}
        onClick={onLogoClick}
      />
      <span>Para conversas que ficam.</span>
      <span className="footer-copy">
        © {new Date().getFullYear()} Perguntas de Conexão
      </span>
    </footer>
  );
}