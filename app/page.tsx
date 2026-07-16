import type { Metadata } from "next";
import HomePage from "./home-page";

export const metadata: Metadata = {
  title: "Before You Buy",
};

export default function Page() {
  return <HomePage />;
}
