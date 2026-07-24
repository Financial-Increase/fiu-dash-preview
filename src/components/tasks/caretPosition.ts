// Computes the pixel offset of a character position inside a <textarea> by
// mirroring its text into an off-screen div with identical typography, then
// reading the position of a marker span. Textareas expose selectionStart/End
// but no API for where that selection actually renders on screen.
const MIRROR_PROPERTIES = [
  "boxSizing",
  "width",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderStyle",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontSize",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "letterSpacing",
  "wordSpacing",
] as const;

export interface CaretCoordinates {
  top: number;
  left: number;
  height: number;
}

export function getCaretCoordinates(element: HTMLTextAreaElement, position: number): CaretCoordinates {
  const div = document.createElement("div");
  document.body.appendChild(div);

  const style = div.style;
  const computed = window.getComputedStyle(element);

  style.position = "absolute";
  style.visibility = "hidden";
  style.whiteSpace = "pre-wrap";
  style.wordWrap = "break-word";

  MIRROR_PROPERTIES.forEach((prop) => {
    (style as unknown as Record<string, string>)[prop] = computed[prop as keyof CSSStyleDeclaration] as string;
  });

  div.textContent = element.value.substring(0, position);

  const span = document.createElement("span");
  span.textContent = element.value.substring(position) || ".";
  div.appendChild(span);

  const coordinates: CaretCoordinates = {
    top: span.offsetTop + parseInt(computed.borderTopWidth, 10),
    left: span.offsetLeft + parseInt(computed.borderLeftWidth, 10),
    height: span.offsetHeight,
  };

  document.body.removeChild(div);
  return coordinates;
}
