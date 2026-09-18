/** Pose `data-theme` avant la peinture : sans ce script, une page en thème sombre
 *  passerait par un flash clair à l'hydratation. */
const script = `(function(){try{var t=localStorage.getItem("gw2rp-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)}catch(e){document.documentElement.setAttribute("data-theme","light")}})()`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
