import { ImageResponse } from "next/og";
import { WheelIcon } from "@/components/wheel-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<WheelIcon size={180} />, size);
}
