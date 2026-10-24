const CHART_COLORS = ["#C4632F", "#C6A044", "#648B91", "#985269", "#49634E", "#806681", "#B95040"];

const Charts = {

    bars(el, data, { format = v => v } = {}) {
        const W = 560, H = 240, pad = { l: 46, r: 10, t: 14, b: 30 };
        const max = Math.max(...data.map(d => d.value), 1);
        const step = (W - pad.l - pad.r) / data.length;
        const barW = Math.min(46, step * 0.6);
        const grid = [0, 0.25, 0.5, 0.75, 1].map(f => {
            const y = pad.t + (H - pad.t - pad.b) * (1 - f);
            return `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}" class="chart-grid"/><text x="${pad.l - 6}" y="${y + 4}" text-anchor="end" class="chart-axis">${format(max * f, true)}</text>`;
        }).join("");
        const bars = data.map((d, i) => {
            const h = (H - pad.t - pad.b) * (d.value / max);
            const x = pad.l + step * i + (step - barW) / 2;
            return `<g><rect x="${x}" y="${H - pad.b - h}" width="${barW}" height="${h}" rx="3" fill="${CHART_COLORS[0]}" class="chart-bar"><title>${d.label}: ${format(d.value)}</title></rect>
                <text x="${x + barW / 2}" y="${H - 10}" text-anchor="middle" class="chart-axis">${d.label}</text></g>`;
        }).join("");
        el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" class="chart-svg">${grid}${bars}</svg>`;
    },

    line(el, data, { format = v => v } = {}) {
        const W = 560, H = 240, pad = { l: 46, r: 14, t: 14, b: 30 };
        const max = Math.max(...data.map(d => d.value), 1);
        const x = i => pad.l + (data.length === 1 ? 0 : i * (W - pad.l - pad.r) / (data.length - 1));
        const y = v => pad.t + (H - pad.t - pad.b) * (1 - v / max);
        const points = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
        const grid = [0, 0.25, 0.5, 0.75, 1].map(f => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(max * f)}" y2="${y(max * f)}" class="chart-grid"/><text x="${pad.l - 6}" y="${y(max * f) + 4}" text-anchor="end" class="chart-axis">${format(max * f, true)}</text>`).join("");
        const every = Math.ceil(data.length / 8);
        const labels = data.map((d, i) => i % every ? "" : `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" class="chart-axis">${d.label}</text>`).join("");
        const dots = data.map((d, i) => `<circle cx="${x(i)}" cy="${y(d.value)}" r="3.5" fill="${CHART_COLORS[0]}"><title>${d.label}: ${format(d.value)}</title></circle>`).join("");
        el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" class="chart-svg">${grid}
            <polygon points="${x(0)},${y(0)} ${points} ${x(data.length - 1)},${y(0)}" fill="${CHART_COLORS[0]}" opacity=".15"/>
            <polyline points="${points}" fill="none" stroke="${CHART_COLORS[0]}" stroke-width="2.5" stroke-linejoin="round"/>${dots}${labels}</svg>`;
    },

    donut(el, data, { format = v => v } = {}) {
        const total = data.reduce((s, d) => s + d.value, 0) || 1;
        const R = 70, C = 2 * Math.PI * R;
        let offset = 0;
        const arcs = data.map((d, i) => {
            const len = C * d.value / total;
            const arc = `<circle r="${R}" cx="100" cy="100" fill="none" stroke="${CHART_COLORS[i % CHART_COLORS.length]}" stroke-width="30" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 100 100)"><title>${d.label}: ${format(d.value)}</title></circle>`;
            offset += len;
            return arc;
        }).join("");
        el.innerHTML = `<div class="donut"><svg viewBox="0 0 200 200" class="donut-svg" role="img">${arcs}<text x="100" y="98" text-anchor="middle" class="donut-total">${format(total)}</text><text x="100" y="118" text-anchor="middle" class="chart-axis">TOTAL</text></svg>
            <ul class="legend">${data.map((d, i) => `<li><i style="background:${CHART_COLORS[i % CHART_COLORS.length]}"></i>${d.label}<b>${format(d.value)}</b></li>`).join("")}</ul></div>`;
    }
};
