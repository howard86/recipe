import { StarIcon } from "@phosphor-icons/react/dist/ssr";

export function Stars({ rating }: { rating: number | null }) {
  if (!rating) {
    return null;
  }
  return (
    <span
      aria-label={`${rating} out of 5`}
      className="inline-flex text-star"
      role="img"
    >
      {[1, 2, 3, 4, 5].map((value) => (
        <StarIcon
          className={value <= rating ? "" : "opacity-25"}
          key={value}
          weight={value <= rating ? "fill" : "regular"}
        />
      ))}
    </span>
  );
}
