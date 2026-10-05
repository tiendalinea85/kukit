import { isDataUrlIcon } from "@/features/categories/domain/customIconRules";

// `Category.icon` es un emoji del catálogo o, si el usuario subió una imagen,
// un data URL PNG. Este componente es el único sitio que decide entre `<img>`
// y texto; en <select> y en spans sueltos no cabe una imagen, ahí se usa
// `iconText`.

interface Props {
  icon: string | undefined;
  className?: string;
}

export function CategoryIcon({ icon, className = "text-lg" }: Props) {
  if (!icon) return null;
  if (!isDataUrlIcon(icon)) {
    return <span className={className}>{icon}</span>;
  }
  // El src es siempre un data URL generado por el usuario (ver customIconRules):
  // `next/image` no lo optimiza y exigiría `images.dataUrlPatterns`, por eso <img>.
  // La CSP ya permite `img-src data:`.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={icon}
      alt=""
      className={`${className} inline-block h-[1.15em] w-[1.15em] align-middle object-contain`}
    />
  );
}