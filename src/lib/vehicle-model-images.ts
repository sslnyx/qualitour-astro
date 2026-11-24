import sienna from "../assets/images/fleet/sienna.png";
import sprinterStandard from "../assets/images/fleet/sprinter-standard.png";
import sprinterDeluxe from "../assets/images/fleet/sprinter-deluxe.png";

const exportedPhotos = import.meta.glob<{ default: ImageMetadata }>(
  "/src/assets/images/fleet/models/*.{webp,png,jpg}",
  { eager: true },
);
const fallbackPhotos: Record<string, ImageMetadata> = {
  "sienna-7": sienna,
  "mercedes-12": sprinterStandard,
  "mercedes-16": sprinterDeluxe,
};

export function vehicleModelImage(id: string): ImageMetadata | undefined {
  const exported = Object.entries(exportedPhotos).find(
    ([path]) => path.replace(/^.*\//, "").replace(/\.[^.]+$/, "") === id,
  );
  return exported?.[1].default ?? fallbackPhotos[id];
}
