export function validateLongUrl(input: string): string {
    let url: URL;
    try {
      url = new URL(input);
    } catch {
      throw new Error("Invalid URL.");
    }
  
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Only http/https URLs are allowed.");
    }
  
    // Optional sanity bound to avoid absurd payloads.
    if (input.length > 2048) {
      throw new Error("URL too long.");
    }
  
    return url.toString();
  }
  