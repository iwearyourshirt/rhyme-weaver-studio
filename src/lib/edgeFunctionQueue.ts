/**
 * Serial queue for edge function invocations.
 * Ensures only one request is in-flight at a time to avoid
 * browser connection pool exhaustion ("Failed to send a request to the Edge Function").
 */

type QueueItem<T> = {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

class EdgeFunctionQueue {
  private queue: QueueItem<any>[] = [];
  private running = false;
  private delayMs = 300; // minimum gap between requests

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }

  private async process() {
    if (this.running) return;
    this.running = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      try {
        const result = await item.fn();
        item.resolve(result);
      } catch (err) {
        item.reject(err);
      }
      // Small delay between requests to let connections close
      if (this.queue.length > 0) {
        await new Promise((r) => setTimeout(r, this.delayMs));
      }
    }

    this.running = false;
  }
}

// Singleton instance
export const edgeFunctionQueue = new EdgeFunctionQueue();
