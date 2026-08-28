import { Feather } from "lucide-react";
import { Link } from "wouter";

type BrandLogoProps = {
  inverse?: boolean;
  testId?: string;
};

export function BrandLogo({
  inverse = false,
  testId = "link-logo",
}: BrandLogoProps) {
  return (
    <Link
      href="/"
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
}: {
  logoTestId?: string;
}) {
  return (
    <footer className="site-footer">
      <BrandLogo inverse testId={logoTestId} />
      <span>Para conversas que ficam.</span>
      <span className="footer-copy">
        © {new Date().getFullYear()} Perguntas de Conexão
      </span>
    </footer>
  );
}