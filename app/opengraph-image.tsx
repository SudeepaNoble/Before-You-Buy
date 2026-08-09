import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background:
            "radial-gradient(circle at 12% 12%, rgba(185, 222, 214, 0.95), transparent 34%), radial-gradient(circle at 88% 18%, rgba(224, 241, 160, 0.82), transparent 28%), linear-gradient(180deg, #edf6ef 0%, #dceee7 100%)",
          color: "#17484d",
          display: "flex",
          height: "100%",
          justifyContent: "space-between",
          padding: "72px 84px",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            maxWidth: "690px",
          }}
        >
          <div
            style={{
              color: "#176b72",
              display: "flex",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Think before you checkout.
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontFamily: "Georgia, serif",
              fontSize: 88,
              fontStyle: "italic",
              fontWeight: 600,
              letterSpacing: "-0.07em",
              lineHeight: 0.92,
            }}
          >
            <span style={{ fontStyle: "normal" }}>Before You</span>
            <span>Buy.</span>
          </div>
          <div
            style={{
              color: "#315e61",
              display: "flex",
              fontSize: 32,
              lineHeight: 1.35,
            }}
          >
            Upload a screenshot or paste a product link, answer three quick
            questions, and get an instant AI recommendation to Buy, Wait, or
            Skip.
          </div>
        </div>
        <div
          style={{
            alignItems: "center",
            background: "linear-gradient(160deg, #2d8b8f 0%, #176b72 100%)",
            borderRadius: "999px",
            boxShadow: "0 26px 80px rgba(23, 107, 114, 0.25)",
            display: "flex",
            height: "260px",
            justifyContent: "center",
            width: "260px",
          }}
        >
          <div
            style={{
              borderBottom: "22px solid white",
              borderRight: "22px solid white",
              height: "112px",
              transform: "rotate(40deg) translateY(-14px)",
              width: "68px",
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
