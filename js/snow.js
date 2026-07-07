/*!
 * Snow.js
 * Falling-particle overlay (snow / stars / raindrops) for a full-page canvas.
 * Originally based on https://github.com/zmfe/snow.js (MIT, 2018),
 * rewritten as a plain ES6 class - this is loaded as a plain <script>
 * on this site, not published as a package, so it doesn't need a
 * UMD/module wrapper or ES5 class polyfills.
 *
 * Usage: new Snow('#selector', { number, r, v, color, shape })
 * shape is 'circle' (default), 'star', or 'raindrop'.
 */
(function () {
    'use strict';

    function degToRad(deg) {
        return Math.PI * (deg / 180);
    }

    // These nudge a particle's travel angle before it's fed into sin/cos,
    // so it drifts side to side instead of falling in a dead-straight
    // line; the exact adjustment amounts are tuned by feel, not derived.
    function sinAdjust(angle) {
        if (angle > degToRad(165)) {
            return angle - Math.PI / 4;
        }
        if (angle < degToRad(15)) {
            return angle + Math.PI / 4;
        }
        return angle;
    }

    function cosAdjust(angle) {
        if (angle > degToRad(15) && angle <= degToRad(90)) {
            return angle - Math.PI / 6;
        }
        if (angle > degToRad(90) && angle <= degToRad(165)) {
            return angle + Math.PI / 6;
        }
        return angle;
    }

    // Traces a 5-point star path centered at (x, y). Caller fills it.
    function traceStarPath(ctx, x, y, r) {
        var spikes = 5;
        var outerRadius = r * 1.8;
        var innerRadius = r * 0.8;
        var rot = (Math.PI / 2) * 3;
        var step = Math.PI / spikes;
        ctx.beginPath();
        ctx.moveTo(x, y - outerRadius);
        for (var i = 0; i < spikes; i += 1) {
            ctx.lineTo(x + Math.cos(rot) * outerRadius, y + Math.sin(rot) * outerRadius);
            rot += step;
            ctx.lineTo(x + Math.cos(rot) * innerRadius, y + Math.sin(rot) * innerRadius);
            rot += step;
        }
        ctx.lineTo(x, y - outerRadius);
        ctx.closePath();
    }

    // Traces a raindrop path (pointed top, rounded bottom) centered at (x, y). Caller fills it.
    function traceRaindropPath(ctx, x, y, r) {
        ctx.beginPath();
        ctx.moveTo(x, y - r * 1.6);
        ctx.bezierCurveTo(x + r * 1.3, y - r * 0.2, x + r, y + r, x, y + r);
        ctx.bezierCurveTo(x - r, y + r, x - r * 1.3, y - r * 0.2, x, y - r * 1.6);
        ctx.closePath();
    }

    class SnowParticle {
        constructor(options) {
            this.ctx = options.ctx;
            this.color = options.color.replace('rgb', 'rgba').split(')')[0] +
                ',' + (Math.floor(Math.random() * 50) + 50) / 100 + ')';
            this.shape = options.shape || 'circle';
            this.r = options.r * (Math.random() * 0.4 + 0.6);
            this.v = options.v;
            this.x = options.x;
            this.y = options.y;
            this.width = options.width;
            this.height = options.height;
            this.angle = Math.PI * Math.random();
        }

        draw() {
            var x = Math.floor(this.x);
            var y = Math.floor(this.y);
            this.ctx.fillStyle = this.color;
            if (this.shape === 'star') {
                traceStarPath(this.ctx, x, y, this.r);
            } else if (this.shape === 'raindrop') {
                traceRaindropPath(this.ctx, x, y, this.r);
            } else {
                this.ctx.beginPath();
                this.ctx.arc(x, y, this.r, 0, 2 * Math.PI, true);
                this.ctx.closePath();
            }
            this.ctx.fill();
        }

        move() {
            this.x += this.v * Math.cos(cosAdjust(this.angle)) * 0.3;
            this.y += this.v * Math.sin(sinAdjust(this.angle));
            if (this.y > this.height || this.x > this.width || this.x < 0) {
                this.y = 0;
                this.x = Math.random() * this.width;
                this.angle = Math.PI * Math.random();
            }
        }
    }

    class Snow {
        /**
         * @param {string} selector CSS selector for the element the canvas is appended to
         * @param {Object} [options]
         * @param {number} [options.number] particle count
         * @param {number} [options.r] base particle radius
         * @param {number} [options.v] fall speed
         * @param {string} [options.color] CSS rgb(...) color
         * @param {string} [options.shape] 'circle' | 'star' | 'raindrop'
         */
        constructor(selector, options) {
            this.element = document.querySelector(selector);
            if (!this.element) {
                return;
            }
            this.options = options || {};
            this.particles = [];
            this.width = 0;
            this.height = 0;

            var prefersReducedMotion = window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (prefersReducedMotion) {
                return;
            }

            this.init();
        }

        init() {
            this.width = window.innerWidth;
            this.height = window.innerHeight;
            this.createCanvas();
            this.createParticles();
            this.animate();
            this.bindResize();
        }

        createCanvas() {
            var canvas = document.createElement('canvas');
            canvas.width = this.width;
            canvas.height = this.height;
            // Fixed + viewport-sized so the snow always covers exactly
            // the visible screen, regardless of how tall the page content is.
            canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;' +
                'background:rgba(0,0,0,0);pointer-events:none;z-index:1;';
            this.element.appendChild(canvas);
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
        }

        createParticles() {
            var number = this.options.number || 0;
            var color = this.options.color || 'rgb(255,255,255)';
            var shape = this.options.shape || 'circle';
            for (var i = 0; i < number; i += 1) {
                var particle = new SnowParticle({
                    ctx: this.ctx,
                    color: color,
                    shape: shape,
                    r: this.options.r,
                    v: this.options.v,
                    x: Math.floor(Math.random() * this.width),
                    y: Math.floor(Math.random() * this.height),
                    width: this.width,
                    height: this.height
                });
                particle.draw();
                this.particles.push(particle);
            }
        }

        animate() {
            var self = this;
            (function frame() {
                self.ctx.clearRect(0, 0, self.width, self.height);
                self.particles.forEach(function (particle) {
                    particle.move();
                    particle.draw();
                });
                requestAnimationFrame(frame);
            })();
        }

        bindResize() {
            var self = this;
            var resizeTimer = null;
            window.addEventListener('resize', function () {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(function () {
                    self.resize();
                }, 150);
            });
        }

        resize() {
            var width = window.innerWidth;
            var height = window.innerHeight;
            var xRatio = this.width ? width / this.width : 1;
            var yRatio = this.height ? height / this.height : 1;
            this.width = width;
            this.height = height;
            this.canvas.width = width;
            this.canvas.height = height;
            // Rescale existing particles proportionally so the snow
            // keeps covering the whole screen immediately, instead of
            // waiting for each particle to wrap around on its own.
            this.particles.forEach(function (particle) {
                particle.width = width;
                particle.height = height;
                particle.x *= xRatio;
                particle.y *= yRatio;
            });
        }
    }

    window.Snow = Snow;
})();
