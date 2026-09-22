import { ImageResponse } from "next/og";
import { WheelIcon } from "@/components/wheel-icon";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<WheelIcon size={512} />, size);
}
