"use client";

import { Markets } from "@/app/components/Markets";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="exchange-shell flex flex-col items-center justify-start p-6 md:p-12"
    >
      <Markets />
    </motion.main>
  );
}
