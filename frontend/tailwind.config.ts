import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Platform colors
        reddit: "#FF4500",
        youtube: "#FF0000",
        bluesky: "#0085FF",
        mastodon: "#6364FF",
        hackernews: "#FF6600",
        twitter: "#1DA1F2",
        tiktok: "#000000",
        instagram: "#E4405F",
        linkedin: "#0A66C2",
        facebook: "#1877F2",
      },
    },
  },
  plugins: [],
};

export default config;
