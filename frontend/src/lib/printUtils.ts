
import api from './api';

const printStyles = `
    @page { size: portrait; margin: 1cm; }
    @page landscape-page { size: landscape; margin: 0.5cm 0.5cm; }
    
    body { font-family: 'Arial', sans-serif; font-size: 10px; color: #000; line-height: 1.2; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page-container { position: relative; min-height: 100%; padding-bottom: 20px; page-break-after: always; break-after: page; }
    .page-container:last-of-type { page-break-after: auto; break-after: auto; }
    .page-landscape { page: landscape-page; }
    
    /* Header Styles */
    .print-header { display: flex; justify-content: space-between; align-items: stretch; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px; }
    .header-logo { height: 60px; width: auto; max-width: 120px; object-fit: contain; }
    .header-left { display: flex; align-items: center; gap: 15px; }
    .header-right { text-align: right; display: flex; flex-direction: column; justify-content: center; }
    .event-title { font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; }
    .protocol-subtitle { font-size: 14px; font-weight: 700; background: #eee; padding: 2px 8px; display: inline-block; margin-top: 4px; }
    .meeting-name { font-size: 14px; font-weight: 700; margin-bottom: 2px; }
    .event-meta { font-size: 11px; color: #444; }

    /* DomTel Style Header (Blue/Official) */
    .protocol-header { display: flex; gap: 0; margin-bottom: 10px; border: none; align-items: stretch; width: 100%; }
    .protocol-header-left { flex: 1.4; display: flex; flex-direction: column; gap: 2px; }
    .protocol-title-box { background: #bae6fd; color: #000; padding: 6px 12px; font-size: 20px; font-weight: 900; -webkit-print-color-adjust: exact; text-transform: uppercase; border: 1px solid #000; border-bottom: none; }
    .protocol-subtitle-box { background: #fff; color: #000; padding: 4px 12px; font-size: 14px; font-weight: 700; -webkit-print-color-adjust: exact; border: 1px solid #000; text-transform: uppercase; display: flex; justify-content: space-between; }
    .protocol-header-right { flex: 1; display: flex; flex-direction: column; align-items: flex-end; justify-content: flex-start; padding-left: 10px; }
    .protocol-meeting-name { font-weight: 900; font-size: 13px; text-transform: none; text-align: right; line-height: 1.2; }
    .protocol-meeting-loc { font-size: 11px; text-align: right; margin-top: 4px; }
    .protocol-logo { height: 50px; width: auto; max-width: 120px; object-fit: contain; margin-left: 10px; }

    .protocol-signatures-top { margin-top: 8px; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; width: 100%; }
    .protocol-signature-row { display: flex; align-items: baseline; gap: 8px; font-size: 10px; font-weight: 700; }
    .protocol-signature-label { min-width: 95px; text-align: right; }
    .protocol-signature-line { border-bottom: 1px dashed #000; width: 180px; height: 12px; display: inline-block; }
    
    .protocol-times-strip { display: flex; justify-content: flex-start; gap: 40px; font-size: 11px; margin-bottom: 10px; padding-left: 5px; }
    .protocol-time-field { display: flex; gap: 5px; align-items: baseline; }
    .protocol-time-dots { display: inline-block; min-width: 150px; font-family: 'Courier New', monospace; letter-spacing: 0.3px; }
    .protocol-regulation-note { margin: 6px 5px 10px; padding: 5px 8px; border: 1px solid #000; background: #fffbe8; font-size: 10px; font-weight: 700; }
    .protocol-section-row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; width: 100%; }
    .protocol-heat-signature-cell { padding: 9px 8px !important; text-align: right; border-top: none !important; border-bottom: 2px solid #000 !important; }
    .protocol-heat-signature-wrap { display: inline-flex; align-items: baseline; gap: 10px; font-size: 10px; font-weight: 700; }
    .protocol-heat-signature-line { display: inline-block; width: 220px; height: 13px; border-bottom: 1px solid #000; }

    /* Tables General */
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px; }
    th { background: #eee; font-weight: 700; text-align: center; padding: 4px; border: 1px solid #000; vertical-align: middle; -webkit-print-color-adjust: exact; }
    td { padding: 4px; border: 1px solid #000; vertical-align: middle; }
    
    /* Start List Table Specifics */
    .start-list-table th { background: #f0f0f0; border: 1px solid #999; border-bottom: 2px solid #000; }
    .start-list-table td { border: 1px solid #ddd; border-bottom: 1px solid #aaa; padding: 6px 4px; font-size: 12px; }
    .start-list-table tr:nth-child(even) { background-color: #f9f9f9; -webkit-print-color-adjust: exact; }

    /* Protocol Field Tables (DomTel) */
    .v-jump-table, .h-jump-table { width: 100%; table-layout: fixed; border: 2px solid #000; }
    .v-jump-table th, .h-jump-table th { background: #bae6fd !important; color: #000 !important; font-size: 10px; font-weight: 700; border: 1px solid #000; }
    .v-jump-table th { height: 38px; }
    .h-jump-table th { height: 36px; }
    .v-jump-table td, .h-jump-table td { border: 1px solid #000; padding: 0; text-align: center; }
    .v-jump-table td { height: 42px; }
    .h-jump-table td { height: 42px; }

    .col-lp { width: 35px; text-align: center; font-weight: 900; }
    .col-bib { width: 45px; text-align: center; font-weight: 900; }
    .col-name { text-align: left; padding: 2px 8px !important; }
    .col-dob { width: 70px; text-align: center; }
    .col-club { text-align: left; padding: 2px 8px !important; font-size: 10px; }
    .col-rec { width: 70px; font-size: 9px; }
    
    .athlete-name { font-weight: 900; font-size: 12px; display: block; }
    .athlete-meta { font-size: 10px; color: #444; margin-top: 1px; }
    
    /* Vertical Jump Specific */
    .col-v-height { font-size: 9px; padding: 2px 0; }
    .col-v-height.v-height-head { border-right: 2px solid #000 !important; }
    .col-v-height.v-height-head.v-height-first { border-left: 2px solid #000 !important; }
    .v-height-header-cell { display: flex; flex-direction: column; height: 100%; width: 100%; }
    .v-height-top-label, .v-height-bottom-label { flex: 1; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; line-height: 1; padding: 0 1px; }
    .v-height-bottom-label { border-top: 1px solid #000; }
    .v-jump-height-cell { padding: 0 !important; border-right: 2px solid #000 !important; }
    .v-jump-height-cell.v-height-first { border-left: 2px solid #000 !important; }
    .v-jump-attempt-container { display: grid; grid-template-columns: repeat(3, 1fr); width: 100%; height: 100%; }
    .v-jump-attempt-box { position: relative; border-right: 1px solid #9c9c9c; box-sizing: border-box; }
    .v-jump-attempt-box:first-child { border-left: 1px solid #9c9c9c; }
    .v-jump-attempt-box::after { content: ''; position: absolute; left: 0; right: 0; top: 50%; border-top: 1px solid #9c9c9c; }
    
    .sponsors-footer { display: flex; justify-content: center; align-items: center; gap: 30px; margin-top: 30px; padding-top: 15px; border-top: 1px dotted #ccc; }
    .sponsor-logo { height: 45px; width: auto; max-width: 160px; object-fit: contain; }
    
    .page-info-footer { position: absolute; bottom: 10px; right: 10px; font-size: 8px; color: #999; }
`;

const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
};

const getLogoUrl = (filename: string) => {
    if (!filename) return '';
    const baseUrl = api.defaults.baseURL || 'http://localhost:3000';
    return `${baseUrl}/meetings/uploads/${filename}`;
};

const getPublicLogoUrl = (filename: string) => {
    if (!filename) return '';
    if (typeof window !== 'undefined' && window.location?.origin) {
        return `${window.location.origin}/${filename}`;
    }
    return `/${filename}`;
};

const groupEntriesByHeat = (entries: any[]) => {
    const sorted = [...entries].sort((a, b) => (a.heat || 99) - (b.heat || 99) || (a.lane || 99) - (b.lane || 99));
    const heats: Record<number, any[]> = {};
    const noHeat: any[] = [];
    sorted.forEach(e => {
        if (e.heat) {
            if (!heats[e.heat]) heats[e.heat] = [];
            heats[e.heat].push(e);
        } else {
            noHeat.push(e);
        }
    });
    return { heats, noHeat };
};

const chunkArray = (items: any[], size: number): any[][] => {
    if (size <= 0) return [items];
    const chunks: any[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
};

const normalizeForMatch = (value: string = '') =>
    value
        .toUpperCase()
        .replace(/\u0141/g, 'L')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

const normalizeHeightValueForPrint = (value: string = ''): string => {
    const compact = String(value).trim().replace(/\s+/g, '').replace(',', '.');
    if (!compact) return '';
    if (/^\d{3}$/.test(compact)) return `${compact[0]}.${compact.slice(1)}`;
    return compact;
};

const isRelayEventForPrint = (event: any): boolean => {
    const code = normalizeForMatch(event?.eventCode || event?.code || '').replace(/[^A-Z0-9]/g, '');
    const name = normalizeForMatch(event?.name || '');
    return code.includes('4X') || code.includes('RELAY') || name.includes('SZTAFET') || name.includes('RELAY');
};

const getIndoorRegulationNote = (meeting: any, event: any): string | null => {
    if ((meeting?.season || '').toUpperCase() !== 'INDOOR') return null;

    const codeRaw = String(event?.eventCode || event?.code || '');
    const code = normalizeForMatch(codeRaw).replace(/[^A-Z0-9]/g, '');
    const name = normalizeForMatch(event?.name || '');
    const numericCode = codeRaw.replace(/[^0-9]/g, '');
    const isRelay = isRelayEventForPrint(event);
    const is400 = !isRelay && (numericCode === '400' || code === '400' || name.includes('400'));
    const is800 = !isRelay && (numericCode === '800' || code === '800' || name.includes('800'));

    if (is400) return 'WA 2026 (hala): serie 4-osobowe, wyłącznie tory 3-6.';
    if (is800) return 'WA 2026 (hala): złamanie do krawężnika przy punkcie ok. 165 m.';
    if (isRelay) return 'WA 2026 (hala): punkt ustalania kolejności sztafet na 200 m; po upadku pałeczki bez obowiązku powrotu do dokładnego miejsca (bez zyskania przewagi).';
    return null;
};

const getEventType = (event: any): 'THROW' | 'HORIZONTAL_JUMP' | 'VERTICAL_JUMP' | 'TRACK' => {
    const name = normalizeForMatch(event.name || '');
    const code = normalizeForMatch(event.code || '').replace(/[^A-Z0-9]/g, '');
    const model = normalizeForMatch(event.model || '');

    // Model hint from source systems (Roster/Starter)
    if (model.startsWith('VERTICAL')) return 'VERTICAL_JUMP';

    // Explicit code mapping
    if (['LJ', 'TJ'].some((c) => code.startsWith(c))) return 'HORIZONTAL_JUMP';
    if (['HJ', 'PV'].some((c) => code.startsWith(c))) return 'VERTICAL_JUMP';
    if (['SP', 'DT', 'HT', 'JT', 'BX'].some((c) => code.startsWith(c))) return 'THROW';

    // Name-based fallback (after diacritics normalization)
    if (name.includes('WZWYZ') || name.includes('TYCZ') || name.includes('HIGH JUMP') || name.includes('POLE VAULT')) return 'VERTICAL_JUMP';
    if (name.includes('DAL') || name.includes('TROJSKOK') || name.includes('WIELOSKOK') || name.includes('LONG JUMP') || name.includes('TRIPLE JUMP')) return 'HORIZONTAL_JUMP';
    if (
        name.includes('PCHN') ||
        name.includes('KULA') ||
        name.includes('SHOT PUT') ||
        name.includes('DYSK') ||
        name.includes('DISCUS') ||
        name.includes('MLOT') ||
        name.includes('HAMMER') ||
        name.includes('OSZCZEP') ||
        name.includes('JAVELIN')
    ) return 'THROW';

    // Generic technical models should never fall back to running protocol
    if (model.startsWith('FIELD') || model.startsWith('QUALIFICATION')) return 'THROW';

    return 'TRACK';
};

// -- HEADER GENERATOR --
const renderHeader = (meeting: any, event: any, titleDetails: string, options: { isProtocol?: boolean; isStartList?: boolean }) => {
    const eventType = getEventType(event);
    const logoUrl = getPublicLogoUrl('pzla-logo.jpg');
    const startDate = event.startTime ? new Date(event.startTime).toLocaleDateString('pl-PL') : formatDate(meeting.date);
    const startTimeRaw = event.startTime ? new Date(event.startTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '';
    const startTime = startTimeRaw.replace(':', '.');
    const regulationNote = options.isProtocol ? getIndoorRegulationNote(meeting, event) : null;

    // Header Label: "Protokół sędziowski" or "Lista Startowa"
    let subTitle = options.isStartList ? 'LISTA STARTOWA' : 'PROTOKÓŁ SĘDZIOWSKI';

    // Use DomTel/Official style for Protocols AND Start Lists for consistency, but tweaked
    return `
        <div class="protocol-header">
            <div class="protocol-header-left">
                <div class="protocol-title-box">${event.name.toUpperCase()}</div>
                <div class="protocol-subtitle-box">
                     <span>${subTitle}</span>
                     ${titleDetails ? `<span>${titleDetails}</span>` : ''}
                </div>
            </div>
            <div class="protocol-header-right">
                <div style="display: flex; justify-content: flex-end; gap: 15px; align-items: center; width: 100%;">
                    <div>
                        <div class="protocol-meeting-name">${meeting.name}</div>
                        <div class="protocol-meeting-loc">${meeting.city || meeting.location || ''}, ${startDate}</div>
                    </div>
                    ${logoUrl ? `<img src="${logoUrl}" class="protocol-logo" alt="PZLA logo" />` : ''}
                </div>
                ${options.isProtocol ? `
                <div class="protocol-signatures-top">
                    <div class="protocol-signature-row">
                        <span class="protocol-signature-label">Sędzia Główny:</span>
                        <span class="protocol-signature-line"></span>
                    </div>
                    <div class="protocol-signature-row">
                        <span class="protocol-signature-label">Sekretariat:</span>
                        <span class="protocol-signature-line"></span>
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
        ${options.isProtocol ? `
        <div class="protocol-times-strip">
             <div class="protocol-time-field">Data: <strong>${startDate}</strong></div>
             <div class="protocol-time-field">Godzina rozp.: <span class="protocol-time-dots">${startTime ? `${startTime} ` : ''}${'.'.repeat(22)}</span></div>
             <div class="protocol-time-field">Godzina zak.: <span class="protocol-time-dots">${'.'.repeat(26)}</span></div>
        </div>
        ${regulationNote ? `<div class="protocol-regulation-note">${regulationNote}</div>` : ''}
        ` : `
        <div class="protocol-times-strip">
             <div class="protocol-time-field">Data: <strong>${startDate}</strong></div>
             <div class="protocol-time-field">Godzina: <strong>${startTime}</strong></div>
        </div>
        `}
    `;
};

// -- FOOTER GENERATOR --
const renderFooter = (meeting?: any, isProtocol = false) => {
    let sponsorsHtml = '';
    if (!isProtocol && meeting?.sponsorLogos && Array.isArray(meeting.sponsorLogos) && meeting.sponsorLogos.length > 0) {
        const logos = meeting.sponsorLogos.map((logo: string) => `<img src="${getLogoUrl(logo)}" class="sponsor-logo" alt="sponsor" />`).join('');
        sponsorsHtml = `<div class="sponsors-footer">${logos}</div>`;
    }
    const generatedInfoHtml = isProtocol ? '' : `<div class="page-info-footer">Wygenerowano: ${new Date().toLocaleString('pl-PL')}</div>`;

    return `
        <div class="footer">
            ${sponsorsHtml}
            ${generatedInfoHtml}
        </div>
    `;
};

// -- HELPERS --
const parseRelaySquad = (entry: any): any[] => {
    if (!entry.relaySquad) return [];
    try {
        if (Array.isArray(entry.relaySquad)) return entry.relaySquad;
        if (typeof entry.relaySquad === 'string') return JSON.parse(entry.relaySquad);
    } catch (e) { /* ignore */ }
    return [];
};

const renderRelaySquadRow = (entry: any, colSpan: number, isProtocol: boolean): string => {
    const squad = parseRelaySquad(entry);
    if (squad.length === 0 && !isProtocol) return ''; // Don't show empty row in start list if no squad, but maybe better to show?

    // Even if empty, for protocol we might want space? No, usually relays are declared.
    const members = squad.map((m: any, i: number) => {
        let meta = [];
        if (m.pb) meta.push(`PB:${m.pb}`);
        if (m.sb) meta.push(`SB:${m.sb}`);
        const metaStr = meta.length > 0 ? ` <i style="color:#555; font-size:9px;">(${meta.join(', ')})</i>` : '';
        return `<span style="margin-right: 15px;"><strong>${i + 1}.</strong> ${m.firstName || ''} ${m.lastName || ''}${metaStr}</span>`;
    }).join('');

    return `<tr class="relay-squad-row"><td colspan="${colSpan}" style="text-align: left; padding: 4px 15px; background: #fff;"><div style="font-size: 10px;">Skład: ${members}</div></td></tr>`;
};

// -- RENDERERS: START LIST --

const renderStartListTable = (entriesList: any[], eventType: string) => {
    // Generic Start List Columns: Order, Bib, Name, DoB, Club, PB, SB
    // For Track: Lane instead of Order
    const isTrack = eventType === 'TRACK';

    let html = `<table class="start-list-table">
        <thead>
            <tr>
                <th style="width: 40px;">${isTrack ? 'Tor' : 'Lp'}</th>
                <th style="width: 50px;">Numer</th>
                <th style="text-align: left; padding-left: 10px;">Zawodnik</th>
                <th style="width: 80px;">Data ur.</th>
                <th style="text-align: left;">Klub (Kraj)</th>
                <th style="width: 70px;">PB</th>
                <th style="width: 70px;">SB</th>
            </tr>
        </thead>
        <tbody>`;

    entriesList.forEach((e, idx) => {
        if (e?.__sectionLabel) {
            html += `<tr><td colspan="7" style="text-align:left; font-weight:900; background:#e9f5ff; padding:6px 10px;">${e.__sectionLabel}</td></tr>`;
            return;
        }

        const order = isTrack ? (e.lane || '-') : (idx + 1);
        const dob = e.dateOfBirth ? new Date(e.dateOfBirth).toLocaleDateString('pl-PL') : (e.yearOfBirth || '');

        html += `<tr>
            <td style="text-align: center; font-weight: 700; font-size: 12px;">${order}</td>
            <td style="text-align: center; font-weight: 700;">${e.bib || ''}</td>
            <td>
                <div class="athlete-name">${e.athleteName}</div>
            </td>
            <td style="text-align: center;">${dob}</td>
            <td class="col-club">${e.club || ''} ${e.countryCode ? `(${e.countryCode})` : ''}</td>
            <td style="text-align: center;">${e.pb || '-'}</td>
            <td style="text-align: center;">${e.sb || '-'}</td>
        </tr>`;

        if (parseRelaySquad(e).length > 0 || e.relaySquad) {
            html += renderRelaySquadRow(e, 7, false);
        }
    });

    html += `</tbody></table>`;
    return html;
};

// -- RENDERERS: PROTOCOLS --

const renderTrackProtocolTable = (entriesList: any[]) => {
    let content = `<table>
        <thead>
            <tr>
                <th style="width: 30px;">Tor</th>
                <th style="width: 40px;">Numer</th>
                <th style="text-align: left;">Zawodnik</th>
                <th style="width: 60px;">Data ur.</th>
                <th style="width: 150px; text-align: left;">Klub</th>
                <th style="width: 50px;">Reakcja</th>
                <th style="width: 80px;">Wynik</th>
                <th style="width: 40px;">Msc</th>
            </tr>
        </thead>
        <tbody>`;

    entriesList.forEach((e) => {
        if (e?.__sectionLabel) {
            if (e.__sectionSignatureLabel) {
                content += `<tr><td colspan="8" style="text-align:left; font-weight:900; background:#e9f5ff; padding:6px 10px;"><span>${e.__sectionLabel}</span><span style="float:right; font-size:10px; font-weight:700;">${e.__sectionSignatureLabel}: _____________________</span></td></tr>`;
            } else {
                content += `<tr><td colspan="8" style="text-align:left; font-weight:900; background:#e9f5ff; padding:6px 10px;">${e.__sectionLabel}</td></tr>`;
            }
            return;
        }

        const year = e.dateOfBirth ? new Date(e.dateOfBirth).getFullYear() : (e.yearOfBirth || '');
        content += `<tr>
            <td style="text-align: center; font-weight: bold; font-size: 12px; height: 30px;">${e.lane || ''}</td>
            <td style="text-align: center; font-weight: bold;">${e.bib || ''}</td>
            <td><div class="athlete-name">${e.athleteName}</div></td>
            <td style="text-align: center;">${year}</td>
            <td style="text-align: left; font-size: 9px;">${e.club || ''}</td>
            <td></td>
            <td></td>
            <td></td>
        </tr>`;
        if (parseRelaySquad(e).length > 0 || e.relaySquad) {
            content += renderRelaySquadRow(e, 8, true);
        }
    });

    content += `</tbody></table>`;
    return content;
};


const getTechnicalTrialsLayout = (event: any) => {
    const rawMode = String(event?.trialsMode || '').toUpperCase();

    if (rawMode === '3') {
        return { mode: '3', firstBlock: 3, secondBlock: 0 };
    }
    if (rawMode === '4') {
        return { mode: '4', firstBlock: 4, secondBlock: 0 };
    }
    if (rawMode === '6_ALL') {
        return { mode: '6_ALL', firstBlock: 6, secondBlock: 0 };
    }

    // Legacy / default: 3+3 final
    return { mode: '6', firstBlock: 3, secondBlock: 3 };
};

const renderFieldProtocolTable = (entriesList: any[], event: any, type: 'HORIZONTAL' | 'VERTICAL' | 'THROW', rowOffset = 0) => {
    // Horizontal & Throws share layout
    if (type === 'HORIZONTAL' || type === 'THROW') {
        const isThrow = type === 'THROW';
        const trials = getTechnicalTrialsLayout(event);
        const attemptLabels = ['I', 'II', 'III', 'IV', 'V', 'VI'];
        const targetRows = 10;
        const displayEntries = entriesList.slice(0, targetRows);

        let content = '';

        if (isThrow) {
            content += `<div style="margin-bottom: 5px; font-weight: 700;">Waga sprzętu: .................... kg</div>`;
        }

        // Standard 3+3 (with final) uses dedicated header
        if (trials.secondBlock > 0) {
            content += `<table class="h-jump-table">
                <thead>
                    <tr>
                        <th rowspan="2" style="width: 30px;">Lp</th>
                        <th rowspan="2" style="width: 40px;">Num</th>
                        <th rowspan="2" style="width: 160px;">Zawodnik / Klub</th>
                        <th rowspan="2" style="width: 60px;">Data ur.</th>
                        <th rowspan="2" style="width: 60px;">PB / SB</th>

                        <th colspan="3" style="height: 18px;">Próby eliminacyjne</th>
                        <th rowspan="2" style="width: 45px;">Wynik<br><span style="font-weight:normal; font-size:8px;">po 3</span></th>
                        <th rowspan="2" style="width: 30px;">Msc<br><span style="font-weight:normal; font-size:8px;">po 3</span></th>

                        <th colspan="3" style="height: 18px;">Finał</th>
                        <th rowspan="2" style="width: 50px;">Wynik</th>
                        <th rowspan="2" style="width: 30px;">Msc</th>
                    </tr>
                    <tr>
                        <th style="width: 35px;">I</th>
                        <th style="width: 35px;">II</th>
                        <th style="width: 35px;">III</th>
                        <th style="width: 35px;">IV</th>
                        <th style="width: 35px;">V</th>
                        <th style="width: 35px;">VI</th>
                    </tr>
                </thead>
                <tbody>`;

            displayEntries.forEach((e, idx) => {
                const lp = rowOffset + idx + 1;
                const dob = e.dateOfBirth ? new Date(e.dateOfBirth).toLocaleDateString('pl-PL') : (e.yearOfBirth || '');
                content += `<tr>
                    <td style="text-align: center; font-weight: 900; height: 42px;">${lp}</td>
                    <td style="text-align: center; font-weight: 900;">${e.bib || ''}</td>
                    <td style="text-align: left; padding: 2px 5px !important;">
                        <span class="athlete-name">${e.athleteName}</span>
                        <span class="athlete-meta" style="font-style:italic;">${e.club || ''}</span>
                    </td>
                    <td style="text-align: center;">${dob}</td>
                    <td style="text-align: center; font-size: 9px; line-height: 1.2;">
                        <div>${e.pb || '-'}</div>
                        <div style="color: #666;">${e.sb || '-'}</div>
                    </td>

                    <td></td><td></td><td></td>
                    <td style="background: #eef;"></td>
                    <td style="background: #eef;"></td>

                    <td></td><td></td><td></td>
                    <td style="background: #eef;"></td>
                    <td></td>
                 </tr>`;
            });

            content += `</tbody></table>`;
            return content;
        }

        // Fixed attempts (3/4/6_ALL): single block without final cut.
        const attemptCount = trials.firstBlock;
        const headerAttempts = attemptLabels
            .slice(0, attemptCount)
            .map((label) => `<th style="width: 35px;">${label}</th>`)
            .join('');

        content += `<table class="h-jump-table">
            <thead>
                <tr>
                    <th rowspan="2" style="width: 30px;">Lp</th>
                    <th rowspan="2" style="width: 40px;">Num</th>
                    <th rowspan="2" style="width: 160px;">Zawodnik / Klub</th>
                    <th rowspan="2" style="width: 60px;">Data ur.</th>
                    <th rowspan="2" style="width: 60px;">PB / SB</th>
                    <th colspan="${attemptCount}" style="height: 18px;">Próby</th>
                    <th rowspan="2" style="width: 50px;">Wynik</th>
                    <th rowspan="2" style="width: 30px;">Msc</th>
                </tr>
                <tr>
                    ${headerAttempts}
                </tr>
            </thead>
            <tbody>`;

        displayEntries.forEach((e, idx) => {
            const lp = rowOffset + idx + 1;
            const dob = e.dateOfBirth ? new Date(e.dateOfBirth).toLocaleDateString('pl-PL') : (e.yearOfBirth || '');
            const attemptCells = Array.from({ length: attemptCount })
                .map(() => '<td></td>')
                .join('');

            content += `<tr>
                <td style="text-align: center; font-weight: 900; height: 42px;">${lp}</td>
                <td style="text-align: center; font-weight: 900;">${e.bib || ''}</td>
                <td style="text-align: left; padding: 2px 5px !important;">
                    <span class="athlete-name">${e.athleteName}</span>
                    <span class="athlete-meta" style="font-style:italic;">${e.club || ''}</span>
                </td>
                <td style="text-align: center;">${dob}</td>
                <td style="text-align: center; font-size: 9px; line-height: 1.2;">
                    <div>${e.pb || '-'}</div>
                    <div style="color: #666;">${e.sb || '-'}</div>
                </td>

                ${attemptCells}
                <td style="background: #eef;"></td>
                <td></td>
             </tr>`;
        });

        content += `</tbody></table>`;
        return content;
    }

    // Vertical Jumps
    else {
        let heightsList: string[] = [];
        if (event.heights) {
            try {
                const parsed = JSON.parse(event.heights);
                heightsList = Array.isArray(parsed) ? parsed : [event.heights];
            } catch (e) {
                heightsList = event.heights.split(/[,;]+/).map((h: string) => h.trim()).filter((h: string) => h !== '');
            }
        }
        heightsList = heightsList.map((h) => normalizeHeightValueForPrint(String(h))).filter((h) => h.length > 0);
        const heightsPerBeam = 12;
        const maxHeightsPerPage = heightsPerBeam * 2;
        const clippedHeights = heightsList.slice(0, maxHeightsPerPage);
        const topHeights = clippedHeights.slice(0, heightsPerBeam);
        const bottomHeights = clippedHeights.slice(heightsPerBeam, maxHeightsPerPage);
        while (topHeights.length < heightsPerBeam) topHeights.push('');
        while (bottomHeights.length < heightsPerBeam) bottomHeights.push('');
        const displayHeights = topHeights.map((top, i) => ({ top, bottom: bottomHeights[i] }));

        // Keep table readable on landscape A4 with fixed athlete/meta columns.
        const fixedColsWidth = 30 + 40 + 200 + 70 + 60 + 55 + 50 + 30;
        const printableLandscapeWidth = 1050;
        const availableForHeights = Math.max(360, printableLandscapeWidth - fixedColsWidth);
        const heightColWidth = Math.max(30, Math.min(46, Math.floor(availableForHeights / Math.max(displayHeights.length, 1))));
        const heightCols = displayHeights
            .map(
                ({ top, bottom }, i) =>
                    `<th class="col-v-height v-height-head${i === 0 ? ' v-height-first' : ''}" style="width: ${heightColWidth}px;"><div class="v-height-header-cell"><div class="v-height-top-label">${top}</div><div class="v-height-bottom-label">${bottom}</div></div></th>`,
            )
            .join('');
        const heightCells = displayHeights.map((_, i) =>
            `<td class="v-jump-height-cell${i === 0 ? ' v-height-first' : ''}" style="width: ${heightColWidth}px;"><div class="v-jump-attempt-container"><div class="v-jump-attempt-box"></div><div class="v-jump-attempt-box"></div><div class="v-jump-attempt-box"></div></div></td>`
        ).join('');

        let content = `<table class="v-jump-table">
            <thead>
                <tr>
                    <th style="width: 30px;">Lp</th>
                    <th style="width: 40px;">Num</th>
                    <th style="width: 200px; text-align: left;">Zawodnik / Klub</th>
                    <th style="width: 70px;">Data ur.</th>
                    <th style="width: 60px;">Rekordy</th>
                    ${heightCols}
                    <th style="width: 55px;">P/Il-X</th>
                    <th style="width: 50px;">Wynik</th>
                    <th style="width: 30px;">Msc</th>
                </tr>
            </thead>
            <tbody>`;

        const targetRows = 10;
        const displayEntries = entriesList.slice(0, targetRows);

        displayEntries.forEach((e, idx) => {
            const lp = rowOffset + idx + 1;
            const dob = e.dateOfBirth ? new Date(e.dateOfBirth).toLocaleDateString('pl-PL') : (e.yearOfBirth || '');
            content += `<tr>
                <td style="text-align: center; font-weight: 900; height: 42px;">${lp}</td>
                <td style="text-align: center; font-weight: 900;">${e.bib || ''}</td>
                <td style="text-align: left; padding: 2px 5px !important;">
                    <span class="athlete-name">${e.athleteName}</span>
                    <span class="athlete-meta">${e.club || ''}</span>
                </td>
                <td style="text-align: center;">${dob}</td>
                <td style="text-align: center; font-size: 9px;">${e.pb || '-'}<br>${e.sb || '-'}</td>
                ${heightCells}
                <td></td>
                <td></td>
                <td></td>
             </tr>`;
        });
        content += `</tbody></table>`;
        return content;
    }
};
// --- EXPORT FUNCTIONS ---

export const generateProtocolHTML = (event: any, entries: any[], meeting: any) => {
    return generatePrintHTML(event, entries, meeting, { isProtocol: true });
};

export const generateStartListHTML = (event: any, entries: any[], meeting: any) => {
    return generatePrintHTML(event, entries, meeting, { isStartList: true });
};

const generatePrintHTML = (event: any, entries: any[], meeting: any, options: { isProtocol?: boolean; isStartList?: boolean }) => {
    const eventType = getEventType(event);
    const { heats, noHeat } = groupEntriesByHeat(entries);
    const heatKeys = Object.keys(heats).map(Number).sort((a, b) => a - b);
    const isTechnical = ['HORIZONTAL_JUMP', 'VERTICAL_JUMP', 'THROW'].includes(eventType);
    const isLandscape = options.isProtocol && isTechnical;

    const genderLabel = event.gender === 'K' ? 'Kobiety' : (event.gender === 'M' ? 'Mężczyźni' : 'Mieszane');
    const ageLabel = event.ageGroup || '';
    const baseTitle = `${genderLabel} ${ageLabel ? ' - ' + ageLabel : ''}`;

    let html = '';

    const renderPage = (entriesList: any[], titleSuffix: string, rowOffset = 0) => {
        let tableContent = '';
        const headerDetails = options.isProtocol ? '' : `${baseTitle} - ${titleSuffix}`;

        if (options.isStartList) {
            tableContent = renderStartListTable(entriesList, eventType);
        } else {
            // Protocol
            if (eventType === 'TRACK') tableContent = renderTrackProtocolTable(entriesList);
            else if (eventType === 'HORIZONTAL_JUMP') tableContent = renderFieldProtocolTable(entriesList, event, 'HORIZONTAL', rowOffset);
            else if (eventType === 'THROW') tableContent = renderFieldProtocolTable(entriesList, event, 'THROW', rowOffset);
            else if (eventType === 'VERTICAL_JUMP') tableContent = renderFieldProtocolTable(entriesList, event, 'VERTICAL', rowOffset);
        }

        return `
            <div class="page-container ${isLandscape ? 'page-landscape' : ''}">
                ${renderHeader(meeting, event, headerDetails, options)}
                ${tableContent}
                ${renderFooter(meeting, !!options.isProtocol)}
            </div>
        `;
    };

    // Technical protocols: one ordered list, max 10 names per page.
    if (options.isProtocol && isTechnical) {
        const orderedEntries = [...heatKeys.flatMap((heat) => heats[heat]), ...noHeat];
        const chunks = chunkArray(orderedEntries, 10);

        if (chunks.length === 0) {
            html += renderPage([], 'Finał');
            return html;
        }

        chunks.forEach((chunk, idx) => {
            const suffix = chunks.length > 1 ? `Finał (${idx + 1}/${chunks.length})` : 'Finał';
            html += renderPage(chunk, suffix, idx * 10);
        });
        return html;
    }

    // Track: single continuous print for all heats/series (start list and protocol).
    if (eventType === 'TRACK') {
        const continuousEntries: any[] = [];
        heatKeys.forEach((heat) => {
            continuousEntries.push({ __sectionLabel: `Seria ${heat}`, __sectionSignatureLabel: options.isProtocol ? 'Sędzia Główny' : undefined });
            continuousEntries.push(...heats[heat]);
        });
        if (noHeat.length > 0) {
            continuousEntries.push({ __sectionLabel: 'Finał', __sectionSignatureLabel: options.isProtocol ? 'Sędzia Główny' : undefined });
            continuousEntries.push(...noHeat);
        }
        if (continuousEntries.length === 0) {
            html += renderPage([], 'Lista');
            return html;
        }

        html += renderPage(continuousEntries, 'Serie');
        return html;
    }

    heatKeys.forEach(heat => {
        html += renderPage(heats[heat], `Grupa ${heat}`);
    });

    if (noHeat.length > 0) {
        html += renderPage(noHeat, 'Finał'); // Default to Final if no heat specified
    }

    // Fallback if no heats and no entries (just empty page)
    if (heatKeys.length === 0 && noHeat.length === 0) {
        html += renderPage([], 'Lista');
    }

    return html;
};

export const generateTimetableHTML = (meeting: any, events: any[]) => {
    // Generate separate rows for primary stages and finals
    const displayRows = events.flatMap(event => {
        const rows = [];

        // Primary stage row (e.g., Eliminations)
        rows.push({
            time: event.startTime ? new Date(event.startTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '--:--',
            name: event.name,
            gender: event.gender === 'K' ? 'K' : (event.gender === 'M' ? 'M' : 'Mix'),
            category: event.ageGroup || '',
            stage: event.stage || (event.finalStartTime ? 'Eliminacje' : 'Finał'),
            sortTime: event.startTime ? new Date(event.startTime).getTime() : 0
        });

        // Add final rows if it has a time and it's not already the primary stage
        if (event.finalStartTime && event.stage !== 'Final') {
            const count = event.finalCount || 1;
            const interval = event.finalInterval || 5;
            let customTimes: string[] = [];
            try { customTimes = JSON.parse(event.finalStartTimes || '[]'); } catch (e) { }

            for (let i = 0; i < count; i++) {
                let startTimeIso = event.finalStartTime;
                if (customTimes[i]) {
                    startTimeIso = customTimes[i];
                } else if (i > 0) {
                    const date = new Date(event.finalStartTime);
                    date.setMinutes(date.getMinutes() + (i * interval));
                    startTimeIso = date.toISOString();
                }

                rows.push({
                    time: new Date(startTimeIso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
                    name: count > 1 ? `${event.name} (Finał ${String.fromCharCode(65 + i)})` : event.name,
                    gender: event.gender === 'K' ? 'K' : (event.gender === 'M' ? 'M' : 'Mix'),
                    category: event.ageGroup || '',
                    stage: 'Finał',
                    sortTime: new Date(startTimeIso).getTime()
                });
            }
        }
        return rows;
    });

    // Sort all rows chronologically
    const sorted = displayRows.sort((a, b) => a.sortTime - b.sortTime);

    let content = `<table style="width: 100%; border: 2px solid #000;">
        <thead style="background: #ddd;">
            <tr>
                <th style="width: 60px;">Godzina</th>
                <th style="text-align: left;">Konkurencja</th>
                <th style="width: 80px;">Płeć</th>
                <th style="width: 100px;">Kategoria</th>
                <th style="width: 100px;">Runda</th>
            </tr>
        </thead>
        <tbody>`;

    sorted.forEach((row) => {
        let stageTranslated = row.stage;
        const sUp = (row.stage || '').toUpperCase();
        if (sUp.includes('HEAT') || sUp.includes('ELIM')) stageTranslated = 'Eliminacje';
        if (sUp.includes('QUAL')) stageTranslated = 'Kwalifikacje';
        if (sUp.includes('FINAL')) stageTranslated = 'Finał';

        content += `<tr>
            <td style="text-align: center; font-weight: 700;">${row.time}</td>
            <td style="font-weight: 700;">${row.name}</td>
            <td style="text-align: center;">${row.gender}</td>
            <td style="text-align: center;">${row.category}</td>
            <td style="text-align: center;">${stageTranslated}</td>
        </tr>`;
    });

    content += `</tbody></table>`;

    return `
        <div class="page-container">
            ${renderHeader(meeting, { name: 'PROGRAM MINUTOWY' } as any, 'Harmonogram zawodów', { isStartList: true })}
            ${content}
            <div style="margin-top: 20px; font-size: 10px; color: #666; text-align: right;">
                Wygenerowano: ${new Date().toLocaleString('pl-PL')}
            </div>
        </div>
    `;
};

export const printBatch = async (meetingId: string, type: 'START_LIST' | 'PROTOCOL') => {
    try {
        const response = await api.get(`/meetings/${meetingId}/print-data`);
        const meeting = response.data;
        if (!meeting || !meeting.events || meeting.events.length === 0) {
            alert('Brak danych do wydruku.');
            return;
        }

        let content = '';
        const sortedEvents = meeting.events.sort((a: any, b: any) => {
            const tA = a.startTime ? new Date(a.startTime).getTime() : 0;
            const tB = b.startTime ? new Date(b.startTime).getTime() : 0;
            return tA - tB;
        });

        sortedEvents.forEach((event: any) => {
            const eventEntries = event.entries || [];
            if (type === 'START_LIST') content += generateStartListHTML(event, eventEntries, meeting);
            else content += generateProtocolHTML(event, eventEntries, meeting);
        });

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        const printTitle = type === 'START_LIST' ? 'Listy Startowe' : '';
        printWindow.document.write(`<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"/><title>${printTitle}</title><style>${printStyles}</style></head><body>${content}<script>window.onload=function(){setTimeout(function(){window.print();window.close();},500);};</script></body></html>`);
        printWindow.document.close();
    } catch (e) { console.error("Error", e); alert("Błąd pobierania danych."); }
};

export const printSingle = (event: any, entries: any[], meeting: any, type: 'START_LIST' | 'PROTOCOL') => {
    const content = type === 'START_LIST' ? generateStartListHTML(event, entries, meeting) : generateProtocolHTML(event, entries, meeting);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const printTitle = type === 'START_LIST' ? event.name : '';
    printWindow.document.write(`<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"/><title>${printTitle}</title><style>${printStyles}</style></head><body>${content}<script>window.onload=function(){setTimeout(function(){window.print();window.close();},500);};</script></body></html>`);
    printWindow.document.close();
};

export const printTimetable = (meeting: any, events: any[]) => {
    const content = generateTimetableHTML(meeting, events);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"/><title>Program Minutowy</title><style>${printStyles}</style></head><body>${content}<script>window.onload=function(){setTimeout(function(){window.print();window.close();},500);};</script></body></html>`);
    printWindow.document.close();
};

