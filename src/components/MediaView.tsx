import { isVideoUrl } from "@/lib/media";

/**
 * Affiche une photo ou une vidéo selon l'adresse. Vidéo : lecteur intégré (lecture au toucher, plein écran
 * possible), seule la première image est chargée tant qu'on ne lance pas la lecture.
 */
export function MediaView({
  src,
  alt = "",
  className = "",
  fit = "cover",
  autoPlay = false,
  controls = true,
}: {
  src: string;
  alt?: string;
  className?: string;
  fit?: "cover" | "contain";
  /** Lecture automatique, sans son et en boucle (bannières). */
  autoPlay?: boolean;
  controls?: boolean;
}) {
  const fitClass = fit === "contain" ? "object-contain" : "object-cover";
  if (isVideoUrl(src)) {
    return (
      <video
        src={autoPlay ? src : `${src}#t=0.1`}
        className={`${fitClass} ${className}`}
        controls={controls && !autoPlay}
        playsInline
        muted={autoPlay}
        autoPlay={autoPlay}
        loop={autoPlay}
        preload="metadata"
        aria-label={alt || "Vidéo"}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" className={`${fitClass} ${className}`} />;
}
