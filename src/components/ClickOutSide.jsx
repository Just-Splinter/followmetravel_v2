import { useEffect } from "react";

export function useClickOutside(ref, callback) {
  useEffect(() => {
    function handler(e) {
      if (!ref.current) return;

      if (!ref.current.contains(e.target)) {
        callback();
      }
    }

    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);

    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [ref, callback]);
}