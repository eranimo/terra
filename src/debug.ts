export class DebugGroup {
  constructor(public label: string) {
    console.groupCollapsed(label)
    console.time(label);
  }

  end() {
    console.timeEnd(this.label);
    console.groupEnd();
  }
}