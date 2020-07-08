/**
 * Expose `Option`.
 */
class Option {

  public required: number;
  public optional: number;
  public bool: boolean;
  public flags: string[];
  public long?: string;
  public short?: string;

  /**
   * Initialize a new `Option` instance.
   *
   * @param {String} _flags
   * @param {String} description
   * @param {Autocomplete} autocomplete
   * @return {Option}
   * @api public
   */
  constructor (_flags: string, public description: string = '') {
    this.required = _flags.includes('<') ? _flags.indexOf('<') : 0
    this.optional = _flags.includes('[') ? _flags.indexOf('[') : 0
    this.bool = !_flags.includes('-no-')

    this.flags = _flags.split(/[ ,|]+/)
    if (this.flags.length > 1 && !/^[[<]/.test(this.flags[1])) {
      this.assignFlag(this.flags.shift()!)
    }
    this.assignFlag(this.flags.shift()!)
  }

  /**
   * Return option name.
   *
   * @return {String}
   * @api private
   */

  public name () {
    if (this.long !== undefined) {
      return this.long.replace('--', '').replace('no-', '')
    }
    return this.short!.replace('-', '')
  }

  /**
   * Check if `arg` matches the short or long flag.
   *
   * @param {String} arg
   * @return {Boolean}
   * @api private
   */

  public is (arg: string) {
    return arg === this.short || arg === this.long
  }

  /**
   * Assigned flag to either long or short.
   *
   * @param {String} flag
   * @api private
   */

  public assignFlag (flag: string) {
    if (flag.startsWith('--')) {
      this.long = flag
    } else {
      this.short = flag
    }
  }

}

export { Option }
