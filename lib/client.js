/**
 * dsh-deepseek-usage — browser half.
 *
 * Hand-written `__ModuleLoader__` bundle (no build step). UI language follows
 * the dsh-usage-stats style: a sidebar footer badge with a live today-token
 * count, a draggable/resizable floating panel with a provider-style balance
 * card, today/month/total usage stats with cache hit rate, a Codex-style blue
 * month heatmap with per-day drill-down, a recent-14-days list, plus period
 * stats (requests/cost/tokens with deltas vs the previous window) and a trend
 * chart. Data comes from the host half's loopback-only endpoints via
 * same-origin fetch.
 */
window.__ModuleLoader__.load({
	id: "dsh-deepseek-usage",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const react = require("react");
		const react_dom = require("react-dom");
		const primitives = require("@deepseek-ai/dsh-client-ui-primitives");

		//#region css
		// Only tokens that exist in the dsh theme; every surface is opaque.
		const css = [
			".du-root{max-width:860px;display:flex;flex-direction:column}",
			".du-section{margin-top:14px}",
			".du-root>.du-section{border-top:1px solid var(--dsw-alias-border-l1);margin-top:16px;padding-top:14px}",
			".du-root>.du-section:first-child{border-top:0;margin-top:0;padding-top:0}",
			".du-sectionTitle{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;line-height:20px;margin:0 0 8px;display:flex;align-items:center;gap:6px}",
			".du-sectionTitle::before{content:\"\";flex:none;width:3px;height:13px;border-radius:2px;background:#1f6feb}",
			".du-note{color:var(--dsw-alias-label-tertiary);margin:4px 0;font-size:12px;line-height:18px}",
			".du-error{background:var(--dsw-alias-interactive-bg-hover-danger,var(--dsw-alias-interactive-bg-hover));color:var(--dsw-alias-state-error-primary);border-radius:8px;justify-content:space-between;align-items:flex-start;gap:8px;margin:4px 0;padding:7px 8px;font-size:12px;line-height:18px;display:flex}",
			".du-retry{color:inherit;font:inherit;cursor:pointer;background:0 0;border:none;flex:none;padding:0}",
			// account / balance card
			".du-balanceCard{--du-accent:#1f6feb;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:linear-gradient(135deg,color-mix(in srgb,var(--du-accent) 8%,transparent),transparent 42%);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:6px}",
			".du-accountHead{align-items:center;gap:8px;display:flex}",
			".du-accountMark{width:24px;height:24px;color:#fff;background:var(--du-accent);border-radius:7px;justify-content:center;align-items:center;font-size:10px;font-weight:700;display:flex;box-shadow:0 4px 12px color-mix(in srgb,var(--du-accent) 25%,transparent);flex:none}",
			".du-accountIdentity{min-width:0;flex:1;display:flex;flex-direction:column}",
			".du-accountName{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;line-height:18px}",
			".du-accountPlan{color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;font-size:10px;line-height:14px;overflow:hidden}",
			".du-accountStatus{color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-interactive-bg-hover);border-radius:999px;padding:2px 7px;font-size:10px;line-height:16px;white-space:nowrap;flex:none}",
			".du-accountStatus[data-status=ok]{color:var(--du-accent);background:color-mix(in srgb,var(--du-accent) 12%,transparent)}",
			".du-accountStatus[data-status=bad]{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent)}",
			".du-balanceMain{align-items:baseline;gap:8px;display:flex}",
			".du-balanceAmount{color:var(--dsw-alias-label-primary);font-size:24px;font-weight:600;line-height:32px;font-variant-numeric:tabular-nums}",
			".du-balanceStatus{align-items:center;gap:5px;font-size:12px;line-height:18px;display:inline-flex}",
			".du-balanceOk{color:var(--dsw-alias-state-success-primary)}",
			".du-balanceBad{color:var(--dsw-alias-state-error-primary)}",
			".du-balanceRows{color:var(--dsw-alias-label-secondary);flex-direction:column;gap:2px;font-size:12px;line-height:18px;display:flex}",
			".du-balanceRow{justify-content:space-between;display:flex}",
			// usage overview stats
			".du-statsRow{display:flex;gap:8px}",
			".du-stat{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;flex:1;flex-direction:column;gap:1px;padding:8px 10px;display:flex;min-width:0}",
			".du-statValue{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:22px;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".du-statLabel{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}",
			".du-hitCaption{color:var(--dsw-alias-label-tertiary);margin-top:6px;font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}",
			".du-hitCaption b{color:var(--dsw-alias-label-secondary);font-weight:600}",
			// period pills + stat cards
			".du-pills{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}",
			".du-pill{font-size:12px;line-height:26px;padding:0 12px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);cursor:pointer}",
			".du-pill:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l3)}",
			".du-pill[data-active=true]{color:#1f6feb;border-color:#1f6feb;background:color-mix(in srgb,#1f6feb 10%,var(--dsw-alias-bg-layer-1))}",
			".du-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:10px}",
			".du-statCard{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:8px 10px;min-width:0;background:var(--dsw-alias-bg-layer-1)}",
			".du-statCardL{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".du-statCardV{color:var(--dsw-alias-label-primary);font-size:17px;font-weight:600;line-height:24px;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".du-statCardS{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:15px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".du-delta{font-size:10px;font-variant-numeric:tabular-nums;margin-left:6px}",
			".du-delta[data-up=true]{color:var(--dsw-alias-state-success-primary)}",
			".du-delta[data-up=false]{color:var(--dsw-alias-state-error-primary)}",
			".du-delta[data-flat=true]{color:var(--dsw-alias-label-tertiary)}",
			// model list (period breakdown)
			".du-modelRow{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;margin-bottom:8px;padding:8px 10px;display:flex;flex-direction:column;gap:4px}",
			".du-modelRow:last-child{margin-bottom:0}",
			".du-modelHead{align-items:center;gap:8px;display:flex}",
			".du-modelName{color:var(--dsw-alias-label-primary);min-width:0;text-overflow:ellipsis;white-space:nowrap;flex:1;font-size:12px;font-weight:500;line-height:18px;overflow:hidden}",
			".du-modelTokens{color:var(--dsw-alias-label-primary);flex:none;font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}",
			".du-modelCost{color:var(--dsw-alias-label-tertiary);flex:none;width:72px;font-size:11px;line-height:18px;font-variant-numeric:tabular-nums;text-align:right}",
			".du-modelBarTrack{background:var(--dsw-alias-interactive-bg-hover);border-radius:2px;height:5px;overflow:hidden}",
			".du-modelBar{background:#1f6feb;border-radius:2px;height:5px}",
			".du-modelMeta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}",
			// trend chart
			".du-seg{display:inline-flex;gap:2px;padding:2px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);margin-bottom:8px}",
			".du-seg button{font-size:12px;line-height:22px;padding:0 10px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}",
			".du-seg button:hover{color:var(--dsw-alias-label-primary)}",
			".du-seg button[data-active=true]{background:#1f6feb;color:#fff}",
			".du-chart{position:relative;width:100%}",
			".du-chart svg{display:block;width:100%;height:auto}",
			".du-tip{position:absolute;pointer-events:none;background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);font-size:12px;line-height:1.5;border-radius:8px;padding:6px 9px;box-shadow:var(--dsw-shadow-lv2);white-space:nowrap;transform:translate(-50%,-110%);z-index:10}",
			// heatmap
			".du-heatHeader{justify-content:space-between;align-items:center;margin-bottom:6px;display:flex}",
			".du-heatHeader .du-sectionTitle{flex:none;margin:0}",
			".du-monthNav{align-items:center;gap:2px;display:flex}",
			".du-navButton{cursor:pointer;width:24px;height:24px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:6px;justify-content:center;align-items:center;padding:0;display:inline-flex;font-size:13px}",
			".du-navButton:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}",
			".du-navButton:disabled{color:var(--dsw-alias-label-caption);cursor:default}",
			".du-monthTitle{color:var(--dsw-alias-label-primary);min-width:88px;font-size:12px;font-weight:500;line-height:24px;text-align:center;font-variant-numeric:tabular-nums}",
			".du-todayButton{cursor:pointer;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:6px;padding:0 6px;font-size:11px;line-height:24px}",
			".du-todayButton:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}",
			".du-monthGrid{flex-direction:column;gap:4px;width:100%;display:flex}",
			".du-weekHeader{color:var(--dsw-alias-label-tertiary);grid-template-columns:repeat(7,1fr);gap:4px;display:grid}",
			".du-weekLabel{font-size:10px;line-height:16px;text-align:center}",
			".du-heatRow{grid-template-columns:repeat(7,1fr);gap:4px;display:grid}",
			".du-cell{aspect-ratio:1/1;min-width:0;width:100%;border-radius:8px;background:rgba(128,128,128,.16);border:0;padding:0;cursor:pointer;justify-content:center;align-items:center;font-family:inherit;display:flex}",
			".du-cell:hover{box-shadow:0 0 0 1px var(--dsw-alias-label-secondary)}",
			".du-cellToday{box-shadow:0 0 0 1px #1f6feb}",
			".du-cellToday:hover{box-shadow:0 0 0 1px #1f6feb}",
			".du-cellSelected{box-shadow:0 0 0 2px var(--dsw-alias-label-primary)}",
			".du-cellSelected:hover{box-shadow:0 0 0 2px var(--dsw-alias-label-primary)}",
			".du-cellDay{font-size:12px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums;pointer-events:none}",
			".du-emptyCell{aspect-ratio:1/1;min-width:0;width:100%}",
			".du-legend{align-items:center;gap:4px;margin-top:6px;font-size:10px;line-height:14px;color:var(--dsw-alias-label-tertiary);display:flex}",
			".du-legendSwatch{width:10px;height:10px;border-radius:2px}",
			// recent days
			".du-days{flex-direction:column;display:flex}",
			".du-day{width:100%;min-height:30px;align-items:center;gap:8px;border:0;background:0 0;border-bottom:1px solid var(--dsw-alias-border-l1);padding:5px 0;font:inherit;text-align:left;cursor:pointer;display:flex}",
			".du-day:last-child{border-bottom:0}",
			".du-day:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".du-dayDate{color:var(--dsw-alias-label-secondary);flex:none;width:96px;font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}",
			".du-dayTokens{color:var(--dsw-alias-label-primary);flex:none;font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}",
			".du-dayHit{color:var(--dsw-alias-label-tertiary);flex:none;width:52px;font-size:11px;line-height:18px;font-variant-numeric:tabular-nums;text-align:right}",
			".du-dayBar{background:#1f6feb;border-radius:2px;height:6px;flex:1;min-width:4px;opacity:.65}",
			// day detail
			".du-detailHeader{align-items:center;gap:8px;display:flex}",
			".du-back{cursor:pointer;width:26px;height:26px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:6px;justify-content:center;align-items:center;padding:0;display:inline-flex;flex:none;font-size:14px}",
			".du-back:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}",
			".du-detailDate{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;line-height:20px}",
			".du-detailHit{color:var(--dsw-alias-label-tertiary);margin-left:auto;font-size:11px;line-height:20px;font-variant-numeric:tabular-nums}",
			".du-detailSummary{color:var(--dsw-alias-label-secondary);margin:6px 0 8px;font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}",
			// footer
			".du-footerNote{color:var(--dsw-alias-label-caption);margin-top:12px;font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}",
			// floating panel chrome
			".du-panel{position:fixed;z-index:9999;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);box-shadow:var(--dsw-shadow-lv2);border-radius:12px;display:flex;flex-direction:column;overflow:hidden;max-width:calc(100vw - 8px);max-height:calc(100vh - 8px)}",
			".du-header{box-sizing:border-box;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);flex:none;justify-content:space-between;align-items:center;min-height:44px;padding:8px 12px;display:flex;cursor:grab;user-select:none;touch-action:none}",
			".du-header:active{cursor:grabbing}",
			".du-headerLeft{align-items:center;gap:8px;display:flex;min-width:0}",
			".du-title{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".du-headerActions{align-items:center;gap:2px;display:flex;flex:none}",
			".du-iconButton{cursor:pointer;width:26px;height:26px;color:var(--dsw-alias-label-tertiary);background:0 0;border:none;border-radius:6px;justify-content:center;align-items:center;padding:0;display:inline-flex}",
			".du-iconButton:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}",
			".du-body{flex:1;min-height:0;padding:4px 14px 14px;overflow-y:auto;scrollbar-width:none;background:var(--dsw-alias-bg-base)}",
			".du-body::-webkit-scrollbar{display:none}",
			".du-rsz{position:absolute;z-index:5}",
			".du-rsz-e{top:0;right:0;width:6px;height:100%;cursor:ew-resize}",
			".du-rsz-s{bottom:0;left:0;width:100%;height:6px;cursor:ns-resize}",
			".du-rsz-c{right:0;bottom:0;width:18px;height:18px;cursor:nwse-resize}",
			".du-rsz-c::after{content:\"\";position:absolute;right:4px;bottom:4px;width:10px;height:10px;background:repeating-linear-gradient(135deg,var(--dsw-alias-label-tertiary) 0 1px,transparent 1px 4px);opacity:.55;pointer-events:none}",
			// sidebar badge
			".du-layer{flex:none;align-items:center;width:100%;height:49px;margin:8px 0 0;display:flex;position:relative}",
			".du-footerButtons{align-items:center;width:100%;display:flex}",
			".du-badge{width:100%;height:49px;color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;border:none;border-radius:12px;align-items:center;gap:8px;padding:0 8px 0 6px;font-family:inherit;font-size:14px;display:inline-flex;overflow:hidden}",
			".du-badge:hover{background:var(--dsw-alias-interactive-bg-hover-solid)}",
			".du-badge[data-active=true]{background:var(--dsw-alias-interactive-bg-hover)}",
			".du-badgeLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden;font-size:13px;line-height:20px}",
			".du-badgeCount{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;flex:none;margin-left:auto;font-size:12px;line-height:16px}",
			".du-layer.du-rail{width:36px;height:36px;margin:0}",
			".du-layer.du-rail .du-badge{border-radius:50%;justify-content:center;gap:0;width:36px;height:36px;padding:0}",
			".du-layer.du-rail .du-footerButtons{flex-direction:column;gap:2px}"
		].join("");
		const tagId = "dsh-deepseek-usage/style";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-deepseek-usage";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion

		//#region formatting + date helpers
		const MS_HOUR = 3600 * 1000;
		const MS_DAY = 24 * MS_HOUR;

		function fmt(n) {
			return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
		}
		function fmtCompact(n) {
			if (n < 1000) return String(n);
			if (n < 1e6) return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)}k`;
			return `${(n / 1e6).toFixed(1)}m`;
		}
		function fmtHit(hitRate) {
			return hitRate === null || hitRate === undefined ? "—" : `${hitRate}%`;
		}
		function fmtCurrency(amount, currency) {
			if (amount === undefined || amount === null) return "—";
			const numeric = Number(amount);
			if (!Number.isFinite(numeric)) return "—";
			try {
				return new Intl.NumberFormat(undefined, { style: "currency", currency: currency ?? "CNY" }).format(numeric);
			} catch {
				return `${currency ?? "CNY"} ${amount}`;
			}
		}
		function fmtDelta(pct) {
			if (pct === null || pct === undefined) return "—";
			const sign = pct > 0 ? "+" : pct < 0 ? "" : "";
			return sign + pct.toFixed(1) + "%";
		}
		function deltaState(pct) {
			if (pct === null || pct === undefined || pct === 0) return { up: pct > 0, flat: pct === 0 };
			return { up: pct > 0, flat: false };
		}
		function dayKeyOf(date) {
			const month = String(date.getMonth() + 1).padStart(2, "0");
			const day = String(date.getDate()).padStart(2, "0");
			return `${date.getFullYear()}-${month}-${day}`;
		}
		function todayKey() {
			return dayKeyOf(new Date());
		}
		function currentMonthKey() {
			const now = new Date();
			return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
		}
		function shiftMonth(key, delta) {
			const [year, month] = key.split("-").map(Number);
			const date = new Date(year, month - 1 + delta, 1);
			return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
		}
		function monthLabelOf(key) {
			const [year, month] = key.split("-").map(Number);
			return `${year}年${month}月`;
		}
		function dayLabel(dateKey) {
			const [, m, d] = dateKey.split("-").map(Number);
			return `${m}月${d}日`;
		}
		function seriesLabel(key) {
			if (typeof key !== "string") return "";
			const [date, time] = key.split("T");
			const mmdd = date.length === 10 ? date.slice(5) : date;
			return time ? `${mmdd} ${time.slice(0, 5)}` : mmdd;
		}
		function periodRange(period, now) {
			const nowMs = now.getTime();
			const startOfMonthMs = new Date(new Date(nowMs).getFullYear(), new Date(nowMs).getMonth(), 1).getTime();
			switch (period) {
				case "24h": return { from: nowMs - MS_DAY, to: nowMs };
				case "7d": return { from: nowMs - 7 * MS_DAY, to: nowMs };
				case "30d": return { from: nowMs - 30 * MS_DAY, to: nowMs };
				case "month": return { from: startOfMonthMs, to: nowMs };
				case "prev-month": {
					const prevStart = new Date(new Date(nowMs).getFullYear(), new Date(nowMs).getMonth() - 1, 1).getTime();
					return { from: prevStart, to: startOfMonthMs };
				}
				case "all": return { from: 0, to: nowMs };
				default: return { from: nowMs - 7 * MS_DAY, to: nowMs };
			}
		}
		//#endregion

		//#region heatmap helpers
		/** Codex-style blue cell: continuous square-root mapping over the month max. */
		const BLUE_RGB = [31, 111, 235];
		function cellColor(tokens, max) {
			if (tokens <= 0) {
				return { background: "rgba(128,128,128,.16)", color: "var(--dsw-alias-label-secondary)" };
			}
			const ratio = max > 0 ? Math.sqrt(tokens / max) : 1;
			const alpha = Math.min(1, 0.22 + 0.78 * ratio);
			return {
				background: `rgba(${BLUE_RGB[0]}, ${BLUE_RGB[1]}, ${BLUE_RGB[2]}, ${alpha.toFixed(3)})`,
				color: alpha >= 0.6 ? "rgba(255,255,255,0.95)" : "var(--dsw-alias-label-primary)"
			};
		}

		/** One month's heatmap grid (Mon-first), padded with null placeholders. */
		function buildMonthHeatmap(dayMap, year, month) {
			const first = new Date(year, month, 1);
			const daysInMonth = new Date(year, month + 1, 0).getDate();
			const lead = (first.getDay() + 6) % 7;
			const weeks = [];
			let max = 0;
			for (let w = 0; w * 7 < lead + daysInMonth; w += 1) {
				const week = [];
				for (let d = 0; d < 7; d += 1) {
					const dayNum = w * 7 + d - lead + 1;
					if (dayNum < 1 || dayNum > daysInMonth) {
						week.push(null);
						continue;
					}
					const key = dayKeyOf(new Date(year, month, dayNum));
					const entry = dayMap.get(key);
					const tokens = entry?.tokens ?? 0;
					week.push({ key, day: dayNum, tokens, hitRate: entry?.cacheHitRate ?? null });
					if (tokens > max) max = tokens;
				}
				weeks.push(week);
			}
			return { weeks, max };
		}
		//#endregion

		//#region data hooks
		function useFetchJson(url, deps, enabled) {
			const [state, setState] = react.useState({ loading: true, data: null, error: null });
			react.useEffect(() => {
				if (enabled === false) return;
				let alive = true;
				setState((s) => ({ ...s, loading: s.data === null, error: null }));
				fetch(url, { headers: { Accept: "application/json" } })
					.then((r) => r.json())
					.then((data) => {
						if (!alive) return;
						setState({ loading: false, data, error: data && data.ok === false ? data.error || "请求失败" : null });
					})
					.catch((error) => {
						if (!alive) return;
						setState({ loading: false, data: null, error: error instanceof Error ? error.message : String(error) });
					});
				return () => { alive = false; };
				// eslint-disable-next-line react-hooks/exhaustive-deps
			}, deps);
			return state;
		}

		function useBalance(refreshKey) {
			return useFetchJson("/deepseek-usage/api/balance", [refreshKey], true);
		}

		function useOverview(period, refreshKey, enabled) {
			const [now, setNow] = react.useState(() => Date.now());
			react.useEffect(() => { setNow(Date.now()); }, [period, refreshKey]);
			const range = periodRange(period, new Date(now));
			const url = `/deepseek-usage/api/overview?from=${+range.from}&to=${+range.to}&bucket=auto`;
			return useFetchJson(url, [period, refreshKey, now], enabled);
		}
		//#endregion

		//#region sub-components
		function Delta({ pct }) {
			const s = deltaState(pct);
			const text = pct === null || pct === undefined ? "无上期数据" : `较上期 ${fmtDelta(pct)}`;
			return react.createElement("span", {
				className: "du-delta",
				"data-up": s.up,
				"data-flat": s.flat,
				title: text
			}, pct === null || pct === undefined ? "—" : fmtDelta(pct));
		}

		function BalanceCard({ balance }) {
			if (!balance) {
				return react.createElement("div", { className: "du-balanceCard" },
					react.createElement("div", { className: "du-accountHead" },
						react.createElement("span", { className: "du-accountMark" }, "DS"),
						react.createElement("span", { className: "du-accountIdentity" },
							react.createElement("span", { className: "du-accountName" }, "DeepSeek"),
							react.createElement("span", { className: "du-accountPlan" }, "官方 API")),
						react.createElement("span", { className: "du-accountStatus" }, "加载中…")),
					react.createElement("div", { className: "du-note" }, "正在查询余额…"));
			}
			if (balance.configured === false) {
				return react.createElement("div", { className: "du-balanceCard" },
					react.createElement("div", { className: "du-accountHead" },
						react.createElement("span", { className: "du-accountMark" }, "DS"),
						react.createElement("span", { className: "du-accountIdentity" },
							react.createElement("span", { className: "du-accountName" }, "DeepSeek"),
							react.createElement("span", { className: "du-accountPlan" }, "官方 API")),
						react.createElement("span", { className: "du-accountStatus", "data-status": "bad" }, "未配置")),
					react.createElement("div", { className: "du-note" }, "未配置 DEEPSEEK_API_KEY 凭据，无法查询余额"));
			}
			if (balance.ok === false) {
				return react.createElement("div", { className: "du-balanceCard" },
					react.createElement("div", { className: "du-accountHead" },
						react.createElement("span", { className: "du-accountMark" }, "DS"),
						react.createElement("span", { className: "du-accountIdentity" },
							react.createElement("span", { className: "du-accountName" }, "DeepSeek"),
							react.createElement("span", { className: "du-accountPlan" }, "官方 API")),
						react.createElement("span", { className: "du-accountStatus", "data-status": "bad" }, "查询失败")),
					react.createElement("div", { className: "du-note" }, balance.error || "未知错误"));
			}
			const status = balance.available ? "ok" : "bad";
			return react.createElement("div", { className: "du-balanceCard" },
				react.createElement("div", { className: "du-accountHead" },
					react.createElement("span", { className: "du-accountMark" }, "DS"),
					react.createElement("span", { className: "du-accountIdentity" },
						react.createElement("span", { className: "du-accountName" }, "DeepSeek"),
						react.createElement("span", { className: "du-accountPlan" }, "官方 API · 充值余额")),
					react.createElement("span", { className: "du-accountStatus", "data-status": status }, balance.available ? "可用" : "不可用")),
				react.createElement("div", { className: "du-balanceMain" },
					react.createElement("span", { className: "du-balanceAmount" }, fmtCurrency(balance.total, balance.currency || "CNY")),
					react.createElement("span", { className: "du-balanceStatus " + (balance.available ? "du-balanceOk" : "du-balanceBad") },
						balance.available ? "API 可用" : "API 不可用")),
				react.createElement("div", { className: "du-balanceRows" },
					react.createElement("div", { className: "du-balanceRow" },
						react.createElement("span", null, "充值余额"),
						react.createElement("span", null, fmtCurrency(balance.toppedUp, balance.currency || "CNY"))),
					react.createElement("div", { className: "du-balanceRow" },
						react.createElement("span", null, "赠送余额"),
						react.createElement("span", null, fmtCurrency(balance.granted, balance.currency || "CNY")))));
		}

		function StatCard({ label, value, sub, delta }) {
			return react.createElement("div", { className: "du-statCard" },
				react.createElement("div", { className: "du-statCardL" }, label),
				react.createElement("div", { className: "du-statCardV" },
					value,
					delta !== undefined ? react.createElement(Delta, { pct: delta }) : null),
				sub ? react.createElement("div", { className: "du-statCardS" }, sub) : null);
		}

		function ModelList({ rows, currency }) {
			if (!rows || rows.length === 0) {
				return react.createElement("p", { className: "du-note" }, "暂无模型数据");
			}
			const totalTokens = rows.reduce((sum, row) => sum + row.tokens, 0);
			return rows.map((row) => {
				const share = totalTokens > 0 ? Math.max(3, Math.round(100 * row.tokens / totalTokens)) : 0;
				return react.createElement("div", { className: "du-modelRow", key: row.model },
					react.createElement("div", { className: "du-modelHead" },
						react.createElement("span", { className: "du-modelName", title: row.model }, row.model),
						react.createElement("span", { className: "du-modelTokens" }, fmt(row.tokens)),
						react.createElement("span", { className: "du-modelCost" }, fmtCurrency(row.cost, currency))),
					react.createElement("div", { className: "du-modelBarTrack" },
						react.createElement("div", { className: "du-modelBar", style: { width: `${share}%` } })),
					react.createElement("div", { className: "du-modelMeta" },
						`${fmt(row.requests)} 次请求 · 输入 ${fmt(row.input)} · 输出 ${fmt(row.output)} · 缓存 ${fmt(row.cacheRead)}`));
			});
		}

		function TrendChart({ series, metric, currency }) {
			const containerRef = react.useRef(null);
			const [hover, setHover] = react.useState(null);
			const W = 640;
			const H = 190;
			const PAD = { l: 46, r: 10, t: 14, b: 26 };
			if (!series || series.length === 0) {
				return react.createElement("p", { className: "du-note" }, "所选时间段内暂无数据");
			}
			const values = series.map((s) => s[metric] || 0);
			const rawMax = Math.max(...values, 0);
			const yMax = rawMax === 0 ? 1 : rawMax * 1.15;
			const n = series.length;
			const innerW = W - PAD.l - PAD.r;
			const innerH = H - PAD.t - PAD.b;
			const x = (i) => PAD.l + (n > 1 ? (i * innerW) / (n - 1) : innerW / 2);
			const y = (v) => PAD.t + innerH - (v / yMax) * innerH;

			const linePath = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
			const areaPath = `${linePath}L${x(n - 1).toFixed(1)},${(PAD.t + innerH).toFixed(1)}L${x(0).toFixed(1)},${(PAD.t + innerH).toFixed(1)}Z`;

			const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ v: yMax * f, y: y(yMax * f) }));
			const labelIdx = n > 2 ? [0, Math.floor((n - 1) / 2), n - 1] : series.map((_, i) => i);
			const metricLabel = metric === "cost" ? "消耗金额" : metric === "requests" ? "请求次数" : "Token消耗";
			const fmtTick = metric === "cost"
				? (v) => v.toFixed(2)
				: metric === "requests" ? (v) => fmtCompact(v) : (v) => fmtCompact(v);

			const onMove = (event) => {
				const rect = containerRef.current?.getBoundingClientRect();
				if (!rect) return;
				const frac = (event.clientX - rect.left) / rect.width;
				const idx = Math.round((frac * W - PAD.l) / (n > 1 ? innerW / (n - 1) : innerW));
				setHover(idx >= 0 && idx < n ? idx : null);
			};

			let tip = null;
			if (hover !== null && series[hover]) {
				const s = series[hover];
				const text = metric === "cost" ? fmtCurrency(s.cost, currency)
					: metric === "requests" ? `${fmt(s.requests)} 次`
					: `${fmt(s.tokens)} tokens`;
				tip = react.createElement("div", {
					className: "du-tip",
					style: { left: `calc(${((x(hover) / W) * 100).toFixed(1)}% )`, top: "12px" }
				},
					react.createElement("div", null, seriesLabel(s.key)),
					react.createElement("div", null, text));
			}

			return react.createElement("div", { className: "du-chart", ref: containerRef, onMouseMove: onMove, onMouseLeave: () => setHover(null) },
				tip,
				react.createElement("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `${metricLabel}趋势` },
					ticks.map((t) => react.createElement("g", { key: t.y },
						react.createElement("line", { x1: PAD.l, x2: W - PAD.r, y1: t.y, y2: t.y, stroke: "var(--dsw-alias-border-l1)", strokeWidth: 1 }),
						react.createElement("text", { x: PAD.l - 8, y: t.y + 3, textAnchor: "end", fontSize: 10, fill: "var(--dsw-alias-label-tertiary)" }, fmtTick(t.v)))),
					labelIdx.map((i) => react.createElement("text", {
						key: i, x: x(i), y: H - 8, textAnchor: i === 0 ? "start" : i === n - 1 ? "end" : "middle",
						fontSize: 10, fill: "var(--dsw-alias-label-tertiary)"
					}, seriesLabel(series[i].key))),
					react.createElement("defs", null,
						react.createElement("linearGradient", { id: "du-grad", x1: 0, y1: 0, x2: 0, y2: 1 },
							react.createElement("stop", { offset: "0%", stopColor: "#1f6feb", stopOpacity: 0.35 }),
							react.createElement("stop", { offset: "100%", stopColor: "#1f6feb", stopOpacity: 0.02 }))),
					react.createElement("path", { d: areaPath, fill: "url(#du-grad)" }),
					react.createElement("path", { d: linePath, fill: "none", stroke: "#1f6feb", strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
					hover !== null ? react.createElement("g", null,
						react.createElement("line", { x1: x(hover), x2: x(hover), y1: PAD.t, y2: PAD.t + innerH, stroke: "var(--dsw-alias-border-l2)", strokeDasharray: "3 3" }),
						react.createElement("circle", { cx: x(hover), cy: y(values[hover]), r: 3.5, fill: "#1f6feb", stroke: "var(--dsw-alias-bg-base)", strokeWidth: 1.5 }))
						: null));
		}

		function MonthHeatmap({ heat, selectedKey, onSelect }) {
			const weekdayLabels = ["一", "二", "三", "四", "五", "六", "日"];
			const today = todayKey();
			return react.createElement("div", null,
				react.createElement("div", { className: "du-monthGrid" },
					react.createElement("div", { className: "du-weekHeader" },
						weekdayLabels.map((label) => react.createElement("span", { className: "du-weekLabel", key: label }, label))),
					heat.weeks.map((week, w) => react.createElement("div", { className: "du-heatRow", key: w },
						week.map((cell, d) => {
							if (cell === null) {
								return react.createElement("span", { className: "du-emptyCell", key: d });
							}
							const colors = cellColor(cell.tokens, heat.max);
							const className = "du-cell"
								+ (cell.key === today ? " du-cellToday" : "")
								+ (cell.key === selectedKey ? " du-cellSelected" : "");
							return react.createElement("button", {
								type: "button",
								className,
								key: d,
								style: colors,
								title: `${cell.key} · ${fmt(cell.tokens)} tokens${cell.hitRate !== null ? ` · 缓存命中 ${cell.hitRate}%` : ""}`,
								"aria-label": `${cell.key} ${fmt(cell.tokens)} tokens`,
								onClick: () => onSelect(cell.key)
							}, react.createElement("span", { className: "du-cellDay" }, cell.day));
						}))),
				react.createElement("div", { className: "du-legend" },
					react.createElement("span", null, "少"),
					react.createElement("span", { className: "du-legendSwatch", style: { background: "rgba(128,128,128,.16)" } }),
					react.createElement("span", { className: "du-legendSwatch", style: { background: "rgba(31,111,235,.3)" } }),
					react.createElement("span", { className: "du-legendSwatch", style: { background: "rgba(31,111,235,.6)" } }),
					react.createElement("span", { className: "du-legendSwatch", style: { background: "rgba(31,111,235,.95)" } }),
					react.createElement("span", null, "多"))));
		}

		function RecentDays({ days, onSelect }) {
			const maxRecent = Math.max(...days.map((d) => d.tokens ?? 0), 1);
			return react.createElement("div", { className: "du-days" },
				days.map((day) => react.createElement("button", {
					type: "button",
					className: "du-day",
					key: day.date,
					onClick: () => onSelect(day.date)
				},
					react.createElement("span", { className: "du-dayDate" }, dayLabel(day.date)),
					react.createElement("span", { className: "du-dayTokens" }, fmt(day.tokens ?? 0)),
					react.createElement("span", { className: "du-dayHit" }, fmtHit(day.cacheHitRate)),
					react.createElement("div", { className: "du-dayBar", style: { width: `${Math.max(4, Math.round(100 * (day.tokens ?? 0) / maxRecent))}%` } }))));
		}

		function DayDetail({ day, onBack }) {
			const models = Array.isArray(day.models) ? day.models : [];
			const totalTokens = day.tokens ?? 0;
			return react.createElement(react.Fragment, null,
				react.createElement("div", { className: "du-detailHeader" },
					react.createElement("button", { type: "button", className: "du-back", "aria-label": "返回", onClick: onBack },
						react.createElement(primitives.IconChevronLeftOutline14, { size: 14 })),
					react.createElement("span", { className: "du-detailDate" }, dayLabel(day.date)),
					react.createElement("span", { className: "du-detailHit" }, `缓存命中率 ${fmtHit(day.cacheHitRate)}`)),
				react.createElement("p", { className: "du-detailSummary" },
					`Token 合计 ${fmt(totalTokens)} · 输入 ${fmt(day.input ?? 0)} · 输出 ${fmt(day.output ?? 0)} · 缓存 ${fmt(day.cacheRead ?? 0)}`),
				react.createElement("div", { className: "du-days" },
					models.length === 0
						? react.createElement("p", { className: "du-note" }, "当天暂无模型数据")
						: models.map((model) => {
							const share = totalTokens > 0 ? Math.max(3, Math.round(100 * (model.tokens ?? 0) / totalTokens)) : 0;
							return react.createElement("div", { className: "du-modelRow", key: model.model },
								react.createElement("div", { className: "du-modelHead" },
									react.createElement("span", { className: "du-modelName", title: model.model }, model.model),
									react.createElement("span", { className: "du-modelTokens" }, fmt(model.tokens ?? 0)),
									react.createElement("span", { className: "du-modelCost" }, fmtHit(model.cacheHitRate))),
								react.createElement("div", { className: "du-modelBarTrack" },
									react.createElement("div", { className: "du-modelBar", style: { width: `${share}%` } })),
								react.createElement("div", { className: "du-modelMeta" },
									`${fmt(model.requests ?? 0)} 次请求 · 输入 ${fmt(model.input ?? 0)} · 输出 ${fmt(model.output ?? 0)} · 缓存 ${fmt(model.cacheRead ?? 0)}`));
						})));
		}
		//#endregion

		//#region dashboard body
		const PERIODS = [
			{ id: "24h", label: "24小时" },
			{ id: "7d", label: "7天" },
			{ id: "30d", label: "30天" },
			{ id: "month", label: "本月" },
			{ id: "prev-month", label: "上月" },
			{ id: "all", label: "全部" }
		];

		/**
		 * Dashboard body shared by the floating panel and the settings page.
		 * `calendarProp` comes from the sidebar trigger (single fetch, live
		 * badge count); balance/overview are fetched here.
		 */
		function Dashboard({ calendarProp, refreshSignal }) {
			const [period, setPeriod] = react.useState("7d");
			const [metric, setMetric] = react.useState("cost");
			const [viewMonth, setViewMonth] = react.useState(() => currentMonthKey());
			const [selectedDay, setSelectedDay] = react.useState(null);
			const [refreshKey, setRefreshKey] = react.useState(0);

			const calendar = calendarProp ?? useFetchJson("/deepseek-usage/api/calendar", [refreshKey], true);
			const balance = useBalance(refreshKey);
			const overview = useOverview(period, refreshKey, !selectedDay);
			const currency = overview.data?.currency || "CNY";

			// External refresh signal (the panel's refresh button).
			react.useEffect(() => {
				setRefreshKey((k) => k + 1);
			}, [refreshSignal]);

			react.useEffect(() => {
				const current = currentMonthKey();
				if (viewMonth > current) setViewMonth(current);
			}, [viewMonth]);

			react.useEffect(() => {
				const timer = setInterval(() => {
					if (typeof document === "undefined" || !document.hidden) setRefreshKey((k) => k + 1);
				}, 60_000);
				return () => clearInterval(timer);
			}, []);

			const dayMap = react.useMemo(() => {
				const map = new Map();
				const days = calendar.data?.days;
				if (Array.isArray(days)) for (const day of days) map.set(day.date, day);
				return map;
			}, [calendar.data]);

			react.useEffect(() => {
				if (selectedDay !== null && !dayMap.has(selectedDay)) setSelectedDay(null);
			}, [dayMap, selectedDay]);

			const heat = react.useMemo(() => {
				const [year, monthOneBased] = viewMonth.split("-").map(Number);
				return buildMonthHeatmap(dayMap, year, monthOneBased - 1);
			}, [dayMap, viewMonth]);

			const stats = react.useMemo(() => {
				const days = calendar.data?.days;
				if (!Array.isArray(days)) return null;
				const today = todayKey();
				const month = today.slice(0, 7);
				let todayEntry = null;
				let dayTokens = 0;
				let monthTokens = 0;
				for (const day of days) {
					if (day.date === today) {
						dayTokens = day.tokens ?? 0;
						todayEntry = day;
					}
					if (day.date.startsWith(month)) monthTokens += day.tokens ?? 0;
				}
				return {
					dayTokens,
					monthTokens,
					total: calendar.data?.total?.tokens ?? 0,
					todayHit: todayEntry?.cacheHitRate ?? null
				};
			}, [calendar.data]);

			const recent = react.useMemo(() => {
				const days = calendar.data?.days;
				if (!Array.isArray(days)) return [];
				const cutoff = new Date();
				cutoff.setDate(cutoff.getDate() - 13);
				const cutoffKey = dayKeyOf(cutoff);
				const today = todayKey();
				return days.filter((day) => day.date >= cutoffKey && day.date <= today && (day.tokens ?? 0) > 0).reverse();
			}, [calendar.data]);

			const selectedEntry = selectedDay !== null ? dayMap.get(selectedDay) ?? null : null;
			const error = calendar.error || balance.error || (selectedDay === null ? overview.error : null);
			const totals = overview.data?.totals;
			const calendarLoading = calendar.loading && !calendar.data;

			return react.createElement("div", { className: "du-root" },
				// account / balance
				react.createElement("div", { className: "du-section" },
					react.createElement("h3", { className: "du-sectionTitle" }, "账户余额"),
					react.createElement(BalanceCard, { balance: balance.data })),

				// usage overview
				react.createElement("div", { className: "du-section" },
					react.createElement("h3", { className: "du-sectionTitle" }, "用量概览"),
					stats === null
						? react.createElement("p", { className: "du-note" }, calendarLoading ? "加载中…" : "暂无用量数据")
						: react.createElement(react.Fragment, null,
							react.createElement("div", { className: "du-statsRow" },
								react.createElement("div", { className: "du-stat" },
									react.createElement("span", { className: "du-statValue" }, fmt(stats.dayTokens)),
									react.createElement("span", { className: "du-statLabel" }, "今日 Token")),
								react.createElement("div", { className: "du-stat" },
									react.createElement("span", { className: "du-statValue" }, fmt(stats.monthTokens)),
									react.createElement("span", { className: "du-statLabel" }, "本月 Token")),
								react.createElement("div", { className: "du-stat" },
									react.createElement("span", { className: "du-statValue" }, fmt(stats.total)),
									react.createElement("span", { className: "du-statLabel" }, "累计 Token"))),
							react.createElement("p", { className: "du-hitCaption" },
								"今日缓存命中率：",
								react.createElement("b", null, fmtHit(stats.todayHit))))),

				error
					? react.createElement("div", { className: "du-section" },
						react.createElement("div", { className: "du-error" },
							react.createElement("span", null, error)))
					: null,

				selectedEntry !== null
					? react.createElement("div", { className: "du-section" },
						react.createElement(DayDetail, { day: selectedEntry, onBack: () => setSelectedDay(null) }))
					: react.createElement(react.Fragment, null,
						// period stats (headline numbers + model breakdown)
						react.createElement("div", { className: "du-section" },
							react.createElement("h3", { className: "du-sectionTitle" }, "时间段统计"),
							react.createElement("div", { className: "du-pills" },
								PERIODS.map((p) => react.createElement("button", {
									key: p.id,
									type: "button",
									className: "du-pill",
									"data-active": period === p.id,
									onClick: () => setPeriod(p.id)
								}, p.label))),
							totals
								? react.createElement("div", { className: "du-grid" },
									react.createElement(StatCard, {
										label: "请求次数",
										value: `${fmt(totals.requests)} 次`,
										sub: totals.requests > 0 ? `平均 ${Math.round(totals.tokens / totals.requests)} tokens/请求` : "无请求",
										delta: overview.data?.deltas?.requests?.pct
									}),
									react.createElement(StatCard, {
										label: "消耗金额",
										value: fmtCurrency(totals.cost, currency),
										sub: overview.data?.costEstimated ? "按模型单价估算" : "平台计费",
										delta: overview.data?.deltas?.cost?.pct
									}),
									react.createElement(StatCard, {
										label: "Token 消耗",
										value: fmtCompact(totals.tokens),
										sub: `输入 ${fmtCompact(totals.input)} · 缓存 ${fmtCompact(totals.cacheRead)}`,
										delta: overview.data?.deltas?.tokens?.pct
									}),
									react.createElement(StatCard, {
										label: "输出 Token",
										value: fmtCompact(totals.output),
										sub: `推理 ${fmtCompact(totals.reasoning || 0)}`,
										delta: undefined
									}))
								: react.createElement("p", { className: "du-note" }, "加载中…"),
							react.createElement("div", { className: "du-section" },
								react.createElement(ModelList, { rows: overview.data?.perModel, currency }))),

						// trend chart (follows the same period selector)
						react.createElement("div", { className: "du-section" },
							react.createElement("h3", { className: "du-sectionTitle" }, "请求量趋势"),
							react.createElement("div", { className: "du-seg" },
								["cost", "requests", "tokens"].map((m) => react.createElement("button", {
									key: m,
									type: "button",
									"data-active": metric === m,
									onClick: () => setMetric(m)
								}, m === "cost" ? "消耗金额" : m === "requests" ? "请求次数" : "Token消耗"))),
							react.createElement(TrendChart, { series: overview.data?.series, metric, currency })),

						// heatmap (day-browsing, at the bottom)
						react.createElement("div", { className: "du-section" },
							react.createElement("div", { className: "du-heatHeader" },
								react.createElement("h3", { className: "du-sectionTitle" }, "月历热力图"),
								react.createElement("div", { className: "du-monthNav" },
									react.createElement("button", { type: "button", className: "du-navButton", "aria-label": "上个月", onClick: () => setViewMonth((m) => shiftMonth(m, -1)) },
										react.createElement(primitives.IconChevronLeftOutline14, { size: 12 })),
									react.createElement("span", { className: "du-monthTitle" }, monthLabelOf(viewMonth)),
									react.createElement("button", {
										type: "button",
										className: "du-navButton",
										"aria-label": "下个月",
										disabled: viewMonth >= currentMonthKey(),
										onClick: () => setViewMonth((m) => shiftMonth(m, 1))
									}, react.createElement(primitives.IconChevronRightOutline14, { size: 12 })),
									viewMonth !== currentMonthKey()
										? react.createElement("button", { type: "button", className: "du-todayButton", onClick: () => setViewMonth(currentMonthKey()) }, "今天")
										: null)),
							react.createElement(MonthHeatmap, { heat, selectedKey: selectedDay, onSelect: setSelectedDay })),

						// recent 14 days
						recent.length > 0
							? react.createElement("div", { className: "du-section" },
								react.createElement("h3", { className: "du-sectionTitle" }, "最近 14 天"),
								react.createElement(RecentDays, { days: recent, onSelect: setSelectedDay }))
							: null),

				react.createElement("p", { className: "du-footerNote" },
					"更新于 " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
					" · 数据来自 DSH 会话日志（提供方上报用量）",
					overview.data?.costEstimated ? " · 费用为估算值" : ""));
		}

		/** Settings page entry: the dashboard body on its own. */
		function UsageSection() {
			return react.createElement(Dashboard, null);
		}
		//#endregion

		//#region floating window + sidebar trigger
		const FLOAT_STATE_KEY = "dsh-deepseek-usage-float";
		const FLOAT_MIN_W = 340;
		const FLOAT_MIN_H = 300;
		const FLOAT_DEFAULT = { w: 440, h: 620 };

		function clampSize(w, h) {
			const maxW = Math.max(FLOAT_MIN_W, (typeof window !== "undefined" ? window.innerWidth : 800) - 8);
			const maxH = Math.max(FLOAT_MIN_H, (typeof window !== "undefined" ? window.innerHeight : 800) - 8);
			return {
				w: Math.min(Math.max(FLOAT_MIN_W, w), maxW),
				h: Math.min(Math.max(FLOAT_MIN_H, h), maxH)
			};
		}

		function loadFloatState() {
			try {
				const raw = localStorage.getItem(FLOAT_STATE_KEY);
				if (raw) {
					const parsed = JSON.parse(raw);
					if (typeof parsed.x === "number" && typeof parsed.y === "number") {
						return {
							x: parsed.x,
							y: parsed.y,
							w: typeof parsed.w === "number" ? parsed.w : FLOAT_DEFAULT.w,
							h: typeof parsed.h === "number" ? parsed.h : FLOAT_DEFAULT.h,
							minimized: parsed.minimized === true
						};
					}
				}
			} catch { /* ignore */ }
			return {
				x: 12,
				y: Math.max(72, (typeof window !== "undefined" ? window.innerHeight : 800) - FLOAT_DEFAULT.h - 150),
				w: FLOAT_DEFAULT.w,
				h: FLOAT_DEFAULT.h,
				minimized: false
			};
		}

		function saveFloatState(state) {
			try { localStorage.setItem(FLOAT_STATE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
		}

		/**
		 * Draggable, resizable floating dashboard window. Drag via the header;
		 * resize via the right/bottom edges and the bottom-right corner (pointer
		 * capture, like a desktop window). Scrollbars are hidden — content
		 * still scrolls with wheel/touch. Position, size and minimized state
		 * persist in localStorage.
		 */
		function UsageFloat({ calendar, onClose, onRefresh }) {
			const initial = react.useMemo(loadFloatState, []);
			const [pos, setPos] = react.useState({ x: initial.x, y: initial.y });
			const [size, setSize] = react.useState(() => clampSize(initial.w, initial.h));
			const [minimized, setMinimized] = react.useState(Boolean(initial.minimized));
			const [refreshSignal, setRefreshSignal] = react.useState(0);
			const posRef = react.useRef(pos);
			const sizeRef = react.useRef(size);
			const drag = react.useRef(null);

			const updatePos = (next) => { posRef.current = next; setPos(next); };
			const updateSize = (next) => { sizeRef.current = next; setSize(next); };
			const persist = () => saveFloatState({ ...posRef.current, ...sizeRef.current, minimized });

			const onHeadPointerDown = (event) => {
				if (event.button !== 0) return;
				drag.current = { kind: "move", startX: event.clientX, startY: event.clientY, baseX: posRef.current.x, baseY: posRef.current.y };
				event.currentTarget.setPointerCapture(event.pointerId);
			};
			const onHeadPointerMove = (event) => {
				const d = drag.current;
				if (!d || d.kind !== "move") return;
				const maxX = Math.max(0, window.innerWidth - sizeRef.current.w - 8);
				const maxY = Math.max(0, window.innerHeight - (minimized ? 44 : sizeRef.current.h) - 8);
				updatePos({
					x: Math.min(Math.max(0, d.baseX + event.clientX - d.startX), maxX),
					y: Math.min(Math.max(0, d.baseY + event.clientY - d.startY), maxY)
				});
			};
			const onHeadPointerUp = (event) => {
				if (!drag.current || drag.current.kind !== "move") return;
				drag.current = null;
				try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
				persist();
			};

			const beginResize = (kind) => (event) => {
				if (event.button !== 0) return;
				drag.current = { kind, startX: event.clientX, startY: event.clientY, baseW: sizeRef.current.w, baseH: sizeRef.current.h };
				event.currentTarget.setPointerCapture(event.pointerId);
			};
			const onResizeMove = (event) => {
				const d = drag.current;
				if (!d || d.kind === "move") return;
				const dx = event.clientX - d.startX;
				const dy = event.clientY - d.startY;
				let w = sizeRef.current.w;
				let h = sizeRef.current.h;
				if (d.kind === "e" || d.kind === "se") w = d.baseW + dx;
				if (d.kind === "s" || d.kind === "se") h = d.baseH + dy;
				updateSize(clampSize(w, h));
			};
			const onResizeUp = (event) => {
				if (!drag.current || drag.current.kind === "move") return;
				drag.current = null;
				try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
				persist();
			};

			const toggleMinimized = () => {
				const next = !minimized;
				setMinimized(next);
				saveFloatState({ ...posRef.current, ...sizeRef.current, minimized: next });
			};
			const stop = (event) => event.stopPropagation();

			return react.createElement("div", {
				className: "du-panel",
				style: { left: pos.x, top: pos.y, width: size.w, height: minimized ? undefined : size.h }
			},
				react.createElement("div", {
					className: "du-header",
					onPointerDown: onHeadPointerDown,
					onPointerMove: onHeadPointerMove,
					onPointerUp: onHeadPointerUp,
					title: "拖动标题栏移动窗口"
				},
					react.createElement("div", { className: "du-headerLeft" },
						react.createElement(primitives.IconDataOutline16, { size: 16 }),
						react.createElement("span", { className: "du-title" }, "DeepSeek 用量")),
					react.createElement("div", { className: "du-headerActions" },
						react.createElement("button", {
							type: "button",
							className: "du-iconButton",
							"aria-label": "刷新",
							title: "刷新",
							onPointerDown: stop,
							onClick: () => {
								setRefreshSignal((s) => s + 1);
								if (typeof onRefresh === "function") onRefresh();
							}
						}, react.createElement(primitives.IconRefreshOutline14, { size: 14 })),
						react.createElement("button", {
							type: "button",
							className: "du-iconButton",
							"aria-label": minimized ? "展开" : "收起",
							title: minimized ? "展开" : "收起",
							onPointerDown: stop,
							onClick: toggleMinimized
						}, react.createElement(minimized ? primitives.IconChevronUpOutline14 : primitives.IconChevronDownOutline14, { size: 14 })),
						react.createElement("button", {
							type: "button",
							className: "du-iconButton",
							"aria-label": "关闭",
							title: "关闭",
							onPointerDown: stop,
							onClick: onClose
						}, react.createElement(primitives.IconCloseOutline16, { size: 14 })))),
				minimized ? null : react.createElement(react.Fragment, null,
					react.createElement("div", { className: "du-body" },
						react.createElement(Dashboard, { calendarProp: calendar, refreshSignal })),
					react.createElement("div", { className: "du-rsz du-rsz-e", onPointerDown: beginResize("e"), onPointerMove: onResizeMove, onPointerUp: onResizeUp }),
					react.createElement("div", { className: "du-rsz du-rsz-s", onPointerDown: beginResize("s"), onPointerMove: onResizeMove, onPointerUp: onResizeUp }),
					react.createElement("div", { className: "du-rsz du-rsz-c", onPointerDown: beginResize("se"), onPointerMove: onResizeMove, onPointerUp: onResizeUp })));
		}

		/** Sidebar footer action: badge with a live today-token count + the panel. */
		function UsageTrigger({ wide }) {
			const [open, setOpen] = react.useState(() => {
				try { return JSON.parse(localStorage.getItem(FLOAT_STATE_KEY) || "{}").open === true; } catch { return false; }
			});
			const [refreshKey, setRefreshKey] = react.useState(0);
			const calendar = useFetchJson("/deepseek-usage/api/calendar", [refreshKey], true);

			react.useEffect(() => {
				const timer = setInterval(() => {
					if (typeof document === "undefined" || !document.hidden) setRefreshKey((k) => k + 1);
				}, 60_000);
				return () => clearInterval(timer);
			}, []);

			const todayCount = (() => {
				const today = todayKey();
				for (const day of calendar.data?.days ?? []) {
					if (day.date === today) return day.tokens ?? 0;
				}
				return 0;
			})();

			const setOpenState = (next) => {
				setOpen(next);
				try {
					const state = JSON.parse(localStorage.getItem(FLOAT_STATE_KEY) || "{}");
					state.open = next;
					localStorage.setItem(FLOAT_STATE_KEY, JSON.stringify(state));
				} catch { /* ignore */ }
			};

			return react.createElement("div", { className: "du-layer" + (wide ? "" : " du-rail") },
				react.createElement("div", { className: "du-footerButtons" },
					react.createElement("button", {
						type: "button",
						className: "du-badge",
						"data-active": open,
						"aria-label": "DeepSeek API 用量",
						"aria-expanded": open,
						onClick: () => setOpenState(!open)
					},
						react.createElement(primitives.IconDataOutline16, { size: wide ? 14 : 18 }),
						wide
							? react.createElement(react.Fragment, null,
								react.createElement("span", { className: "du-badgeLabel" }, "用量"),
								react.createElement("span", { className: "du-badgeCount" }, calendar.data ? fmtCompact(todayCount) : ""))
							: null)),
				open
					? react_dom.createPortal(react.createElement(UsageFloat, {
						calendar,
						onClose: () => setOpenState(false),
						onRefresh: () => setRefreshKey((k) => k + 1)
					}), document.body)
					: null);
		}
		//#endregion

		/** Required services: slot registry only (data arrives over plain HTTP). */
		const inject = ["slots"];

		/**
		 * Client plugin body: register the dashboard as a settings section and
		 * as a sidebar footer action that opens the floating window.
		 * @param ctx - client root context.
		 */
		function apply(ctx) {
			// Settings page entry (full-page view).
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "deepseek-usage",
				order: 40,
				label: () => "DeepSeek 用量"
			}, UsageSection));
			// Sidebar footer action: badge + draggable floating dashboard.
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "deepseek-usage",
				order: 10
			}, UsageTrigger));
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
