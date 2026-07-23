import { useState, type ImgHTMLAttributes } from "react";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
  /** Above-the-fold / LCP rasm — darhol yuklash. */
  priority?: boolean;
};

/** Tez rasm: lazy, async decode, xato bo'lsa yashirish. */
export default function OptimizedImage({
  src,
  alt = "",
  className,
  priority = false,
  ...rest
}: Props) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) return null;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      {...(priority ? { fetchPriority: "high" as const } : {})}
      onError={() => setFailed(true)}
      {...rest}
    />
  );
}
