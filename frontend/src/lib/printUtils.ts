
import api from './api';

const printStyles = `
    @page { size: portrait; margin: 1cm; }
    @page landscape-page { size: landscape; margin: 1cm; }
    
    body { font-family: 'Arial', sans-serif; font-size: 10px; color: #000; line-height: 1.2; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page-container { position: relative; min-height: 100%; padding-bottom: 20px; page-break-after: always; }
    .page-container:last-child { page-break-after: auto; }
    .page-landscape { page: landscape-page; }
    
    .print-header { display: flex; justify-content: space-between; align-items: stretch; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 8px; }
    .header-left { flex: 2; display: flex; align-items: center; gap: 12px; }
    .header-logo { height: 50px; width: auto; max-width: 150px; object-fit: contain; }
    .header-center { flex: 1; text-align: center; }
    .header-right { flex: 2; text-align: right; display: flex; flex-direction: column; justify-content: flex-end; }
    
    .event-title { font-weight: 700; font-size: 16px; text-transform: uppercase; margin-bottom: 2px; }
    .event-meta { font-size: 11px; margin-bottom: 2px; }
    .meeting-name { font-size: 13px; font-weight: 700; color: #000; text-transform: uppercase; }
    
    table { width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: fixed; font-size: 9px; }
    .page-landscape table { font-size: 10px; }
    
    th { border: 1px solid #000; padding: 4px; font-weight: 700; background: #eee; color: #000; text-align: center; vertical-align: middle; height: 32px; }
    td { border: 1px solid #000; padding: 4px; vertical-align: middle; height: 26px; }
    .page-landscape td { height: 30px; }
    
    .col-lp { width: 25px; text-align: right; border-right: none; }
    .col-lp-val { text-align: center; }
    .col-name-container { display: flex; flex-direction: column; }
    .athlete-name { font-weight: 700; font-size: 10px; }
    .page-landscape .athlete-name { font-size: 11px; }
    .athlete-meta { font-size: 8px; color: #444; margin-top: 1px; }
    .col-bib { width: 35px; text-align: center; }
    .col-club { font-size: 9px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    
    .relay-squad-row td { border-top: none; padding: 2px 4px 4px 4px; height: auto; }
    .relay-squad { font-size: 10px; color: #333; padding-left: 5px; }
    .relay-squad span { margin-right: 8px; }
    .relay-squad .squad-num { font-weight: 700; color: #666; margin-right: 2px; }
    
    .footer { margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
    .signature-box { display: flex; flex-direction: column; align-items: center; width: 180px; }
    .signature-line { border-top: 1px dotted #000; width: 100%; height: 1px; margin-bottom: 5px; }
    .signature-label { font-size: 8px; text-transform: uppercase; }
    
    .roster-footer { position: fixed; bottom: 5px; right: 5px; font-size: 7px; color: #888; transform: rotate(-90deg); transform-origin: right bottom; }
    
    /* Specific Column Widths */
    .w-30 { width: 30px; }
    .w-40 { width: 40px; }
    .w-50 { width: 50px; }
    .w-60 { width: 60px; }
    .w-80 { width: 80px; }
    
    /* Timetable Specific */
    .timetable-table th { background: #f8fafc; color: #1e293b; border-bottom: 2px solid #000; }
    .timetable-time { font-weight: 700; font-size: 11px; width: 60px; text-align: center; }
    .timetable-event { font-weight: 700; text-transform: uppercase; }
    .timetable-meta { font-size: 8px; color: #64748b; }
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

const getEventType = (event: any): 'THROW' | 'HORIZONTAL_JUMP' | 'VERTICAL_JUMP' | 'TRACK' => {
    const name = (event.name || '').toUpperCase();
    const code = (event.code || '').toUpperCase();

    if (['LJ', 'TJ'].includes(code)) return 'HORIZONTAL_JUMP';
    if (['HJ', 'PV'].includes(code)) return 'VERTICAL_JUMP';
    if (['SP', 'DT', 'HT', 'JT', 'BX'].includes(code)) return 'THROW';

    if (name.includes('KULA') || name.includes('DYSK') || name.includes('MŁOT') || name.includes('OSZCZEP') || name.includes('PIŁECZKA') ||
        name.includes('SHOT') || name.includes('DISCUS') || name.includes('HAMMER') || name.includes('JAVELIN')) {
        return 'THROW';
    }

    if (name.includes('W DAL') || name.includes('TRÓJSKOK') || name.includes('LONG JUMP') || name.includes('TRIPLE JUMP') || name.includes('WIELOSKOK')) {
        return 'HORIZONTAL_JUMP';
    }

    if (name.includes('WZWYŻ') || name.includes('TYCZKA') || name.includes('HIGH JUMP') || name.includes('POLE VAULT')) {
        return 'VERTICAL_JUMP';
    }

    return 'TRACK';
};

// Generate Athlete Meta String (e.g. "2008 · POL")
const getAthleteMeta = (entry: any) => {
    const year = entry.dateOfBirth ? new Date(entry.dateOfBirth).getFullYear() : (entry.yearOfBirth || '');
    const country = entry.countryCode || 'POL';
    const parts = [];
    if (year) parts.push(year);
    if (country) parts.push(country);
    return parts.join(' · ');
};

// -- HEADER GENERATOR --
const renderHeader = (meeting: any, event: any, titleDetails: string) => {
    const logoUrl = meeting.organizerLogo ? getLogoUrl(meeting.organizerLogo) : '';
    return `
        <div class="print-header">
            <div class="header-left">
                ${logoUrl ? `<img src="${logoUrl}" class="header-logo" alt="logo" />` : ''}
                <div>
                    <div class="meeting-name">${meeting.name}</div>
                    <div class="event-meta">${meeting.location}, ${formatDate(meeting.date)}</div>
                </div>
            </div>
            <div class="header-center"></div>
            <div class="header-right">
                 <div class="event-title">${event.name}</div>
                 <div class="event-meta">${titleDetails}</div>
            </div>
        </div>
    `;
};

// -- FOOTER GENERATOR --
const renderFooter = () => {
    return `
        <div class="footer">
            <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-label">Arbiter</div>
            </div>
            <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-label">Podpis</div>
            </div>
            <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-label">Sędzia notujący</div>
            </div>
            <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-label">Podpis</div>
            </div>
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

const renderRelaySquadRow = (entry: any, colSpan: number): string => {
    const squad = parseRelaySquad(entry);
    if (squad.length === 0) return '';
    const members = squad.map((m: any, i: number) => {
        let meta = '';
        if (m.pb) meta += ` PB: ${m.pb}`;
        if (m.sb) meta += ` SB: ${m.sb}`;
        return `<span><span class="squad-num">${i + 1}.</span>${m.firstName || ''} ${m.lastName || ''}${meta ? `<small style="font-weight: normal; color: #555;"> (${meta.trim()})</small>` : ''}</span>`;
    }).join('');
    return `<tr class="relay-squad-row"><td colspan="${colSpan}" style="text-align: left;"><div class="relay-squad">${members}</div></td></tr>`;
};

// -- RENDERERS --

const renderTrackTable = (entriesList: any[]) => {
    let content = `<table>
        <thead>
            <tr>
                <th class="w-30">Tor</th>
                <th style="text-align: left; padding-left: 10px;">Zawodnik</th>
                <th class="w-40">Numer</th>
                <th style="width: 150px;">Klub</th>
                <th class="w-60">Wynik</th>
                <th class="w-30">Msc</th>
            </tr>
        </thead>
        <tbody>`;

    entriesList.forEach((e) => {
        content += `<tr>
            <td style="text-align: center; font-weight: bold;">${e.lane || ''}</td>
            <td>
                <div class="col-name-container">
                    <span class="athlete-name">${e.athleteName}</span>
                    <span class="athlete-meta">${getAthleteMeta(e)}</span>
                </div>
            </td>
            <td class="col-bib">${e.bib || ''}</td>
            <td class="col-club">${e.club || ''}</td>
            <td></td>
            <td></td>
        </tr>`;
        content += renderRelaySquadRow(e, 6);
    });

    content += `</tbody></table>`;
    return content;
};

const renderFieldRow = (e: any, idx: number, cellCount: number, showLp = true) => {
    const cells = [];
    for (let i = 0; i < cellCount; i++) cells.push('<td></td>');

    return `<tr>
        ${showLp ? `<td class="col-lp-val">${idx + 1}</td>` : ''}
        <td>
            <div class="col-name-container">
                <span class="athlete-name">${e.athleteName}</span>
                <span class="athlete-meta">${getAthleteMeta(e)}</span>
            </div>
        </td>
        <td class="col-bib">${e.bib || ''}</td>
        <td class="col-club">${e.club || ''}</td>
        ${cells.join('')}
    </tr>`;
};

const renderHorizontalJumpsTable = (entriesList: any[]) => {
    let content = `<table>
        <thead>
            <tr>
                <th class="w-30">Lp.</th>
                <th style="text-align: left; padding-left: 10px;">Zawodnik</th>
                <th class="w-40">Numer</th>
                <th style="width: 120px;">Klub</th>
                <th class="w-30">1</th>
                <th class="w-30">2</th>
                <th class="w-30">3</th>
                <th class="w-30" style="font-size: 8px; line-height: 1;">Br. <br>Top 8</th>
                <th class="w-30">Msc</th>
                <th class="w-30">4</th>
                <th class="w-30">5</th>
                <th class="w-30">6</th>
                <th class="w-40">Wynik</th>
                <th class="w-30">Msc</th>
            </tr>
        </thead>
        <tbody>`;

    entriesList.forEach((e, idx) => {
        content += renderFieldRow(e, idx, 10); // 3+1+1 + 3+1+1 = 10 result columns
    });

    content += `</tbody></table>`;
    return content;
};

const renderThrowsTable = (entriesList: any[]) => {
    let content = `<table>
        <thead>
            <tr>
                <th class="w-30">Lp.</th>
                <th style="text-align: left; padding-left: 10px;">Zawodnik</th>
                <th class="w-40">Numer</th>
                <th style="width: 120px;">Klub</th>
                <th class="w-40">1</th>
                <th class="w-40">2</th>
                <th class="w-40">3</th>
                <th class="w-40" style="font-size: 8px; line-height: 1;">Br. <br>Top 8</th>
                <th class="w-30">Msc</th>
                <th class="w-40">4</th>
                <th class="w-40">5</th>
                <th class="w-40">6</th>
                <th class="w-50">Wynik</th>
                <th class="w-30">Msc</th>
            </tr>
        </thead>
        <tbody>`;

    entriesList.forEach((e, idx) => {
        content += renderFieldRow(e, idx, 10);
    });

    content += `</tbody></table>`;
    return content;
};

const renderVerticalJumpTable = (entriesList: any[], event: any) => {
    // Get heights from event or default
    let heightsList: string[] = [];
    try {
        heightsList = event.heights ? JSON.parse(event.heights) : [];
    } catch (e) { }

    if (heightsList.length === 0) {
        // Default empty heights if none defined
        heightsList = ['', '', '', '', '', '', '', '', '', ''];
    }

    // Limit to reasonable number for PDF
    const displayHeights = heightsList.slice(0, 12);
    const heightCols = displayHeights.map(h => `<th class="w-30">${h}</th>`).join('');
    const emptyCells = displayHeights.map(() => `<td></td>`).join('');

    let content = `<table>
        <thead>
            <tr>
                <th class="w-30">Lp.</th>
                <th style="text-align: left; padding-left: 10px;">Zawodnik</th>
                <th class="w-40">Numer</th>
                <th style="width: 120px;">Klub</th>
                <th class="w-40" style="font-size: 8px; line-height: 1;">Pierwsza<br>wysokość</th>
                ${heightCols}
                <th class="w-50">Wynik</th>
                <th class="w-30">Msc</th>
            </tr>
        </thead>
        <tbody>`;

    entriesList.forEach((e, idx) => {
        content += `<tr>
            <td class="col-lp-val">${idx + 1}</td>
            <td>
                <div class="col-name-container">
                    <span class="athlete-name">${e.athleteName}</span>
                    <span class="athlete-meta">${getAthleteMeta(e)}</span>
                </div>
            </td>
            <td class="col-bib">${e.bib || ''}</td>
            <td class="col-club">${e.club || ''}</td>
            <td></td>
            ${emptyCells}
            <td></td>
            <td></td>
        </tr>`;
    });

    content += `</tbody></table>`;
    return content;
};


const renderTimetableTable = (events: any[]) => {
    // Sort events by time
    const sorted = [...events].sort((a, b) => {
        if (!a.startTime && !b.startTime) return a.name.localeCompare(b.name);
        if (!a.startTime) return 1;
        if (!b.startTime) return -1;
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });

    let content = `<table class="timetable-table">
        <thead>
            <tr>
                <th style="width: 80px;">Godzina</th>
                <th style="text-align: left; padding-left: 15px;">Konkurencja</th>
                <th style="width: 80px;">Płeć</th>
                <th style="width: 100px;">Kategoria</th>
                <th style="width: 100px;">Runda</th>
                <th style="width: 80px;">Uwagi</th>
            </tr>
        </thead>
        <tbody>`;

    sorted.forEach((event) => {
        const time = event.startTime ? new Date(event.startTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '--:--';
        const gender = event.gender === 'K' ? 'Kobiety' : (event.gender === 'M' ? 'Mężczyźni' : 'Mieszane');

        let stageTranslated = event.stage || 'Finał';
        const stageUpper = (stageTranslated || '').toUpperCase();
        if (stageUpper.includes('FINAL')) stageTranslated = 'Finał';
        else if (stageUpper.includes('HEAT')) stageTranslated = 'Eliminacje';
        else if (stageUpper.includes('SEMI')) stageTranslated = 'Półfinał';
        else if (stageUpper.includes('QUAL')) stageTranslated = 'Kwalifikacje';

        content += `<tr>
            <td class="timetable-time">${time}</td>
            <td style="padding-left: 15px;">
                <div class="timetable-event">${event.name}</div>
            </td>
            <td style="text-align: center;">${gender}</td>
            <td style="text-align: center;">${event.ageGroup || 'Senior'}</td>
            <td style="text-align: center;">${stageTranslated}</td>
            <td></td>
        </tr>`;
    });

    content += `</tbody></table>`;
    return content;
};

// --- EXPORT FUNCTION ---

export const generateProtocolHTML = (event: any, entries: any[], meeting: any) => {
    const eventType = getEventType(event);
    const { heats, noHeat } = groupEntriesByHeat(entries);
    const heatKeys = Object.keys(heats).map(Number).sort((a, b) => a - b);

    let html = '';

    const genderLabel = event.gender === 'K' ? 'Kobiety' : (event.gender === 'M' ? 'Mężczyźni' : 'Mieszane');
    const ageLabel = event.ageGroup || '';
    const baseTitle = `${genderLabel} · ${ageLabel}`;

    const renderPage = (entriesList: any[], titleSuffix: string) => {
        const fullTitle = `${baseTitle} · ${titleSuffix}`;
        const isLandscape = ['HORIZONTAL_JUMP', 'VERTICAL_JUMP', 'THROW'].includes(eventType);

        let tableContent = '';
        switch (eventType) {
            case 'HORIZONTAL_JUMP':
                tableContent = renderHorizontalJumpsTable(entriesList);
                break;
            case 'VERTICAL_JUMP':
                tableContent = renderVerticalJumpTable(entriesList, event);
                break;
            case 'THROW':
                tableContent = renderThrowsTable(entriesList);
                break;
            case 'TRACK':
            default:
                tableContent = renderTrackTable(entriesList);
                break;
        }

        return `
            <div class="page-container ${isLandscape ? 'page-landscape' : ''}">
                ${renderHeader(meeting, event, fullTitle)}
                ${tableContent}
                ${renderFooter()}
            </div>
        `;
    };

    heatKeys.forEach(heat => {
        html += renderPage(heats[heat], `Seria ${heat}`);
    });

    if (noHeat.length > 0) {
        html += renderPage(noHeat, `Finał`);
    }

    // Wrap in standard print shell is done by caller usually, but here we return inner HTML
    return html;
};

export const generateTimetableHTML = (meeting: any, events: any[]) => {
    return `
        <div class="page-container">
            ${renderHeader(meeting, { name: 'PROGRAM MINUTOWY' }, 'Harmonogram zawodów')}
            ${renderTimetableTable(events)}
            <div style="margin-top: 20px; font-size: 8px; color: #666; text-align: right;">
                Wygenerowano: ${new Date().toLocaleString('pl-PL')}
            </div>
        </div>
    `;
};

// Re-export start list as well (can share same new look or simplified)
export const generateStartListHTML = (event: any, entries: any[], meeting: any) => {
    // Start list is basically track table but without result columns filled (which they are empty anyway)
    // Maybe simpler columns for start list?
    // Roster start list crop 1 shows: Order, Name, Bib, Club, Result, Place.
    // So identical to track protocol but just "Lista Startowa" title.
    return generateProtocolHTML(event, entries, meeting); // Reuse same clean layout
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
        meeting.events.forEach((event: any) => {
            const eventEntries = event.entries || [];
            if (type === 'START_LIST') {
                content += generateStartListHTML(event, eventEntries, meeting);
            } else {
                content += generateProtocolHTML(event, eventEntries, meeting);
            }
        });

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Zablokowano wyskakujące okno.');
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${type === 'START_LIST' ? 'Listy Startowe' : 'Protokoły'}</title>
                <style>${printStyles}</style>
            </head>
            <body>
                ${content}
                <script>
                    window.onload = function() { 
                        setTimeout(function() { window.print(); window.close(); }, 500); 
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();

    } catch (e) {
        console.error("Error printing", e);
        alert("Błąd.");
    }
};

export const printSingle = (event: any, entries: any[], meeting: any, type: 'START_LIST' | 'PROTOCOL') => {
    // Reuse batch logic but for single event
    const content = type === 'START_LIST'
        ? generateStartListHTML(event, entries, meeting)
        : generateProtocolHTML(event, entries, meeting);

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${event.name}</title>
                <style>${printStyles}</style>
            </head>
            <body>
                ${content}
                <script>
                    window.onload = function() { 
                        setTimeout(function() { window.print(); window.close(); }, 500); 
                    };
                </script>
            </body>
            </html>
        `);
    printWindow.document.close();
};

export const printTimetable = (meeting: any, events: any[]) => {
    const content = generateTimetableHTML(meeting, events);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Program Minutowy - ${meeting.name}</title>
            <style>${printStyles}</style>
        </head>
        <body>
            ${content}
            <script>
                window.onload = function() { 
                    setTimeout(function() { window.print(); window.close(); }, 500); 
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
};
