
import api from './api';

const printStyles = `
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { text-align: center; font-size: 24px; margin-bottom: 5px; font-weight: bold; text-transform: uppercase; }
    h2 { text-align: center; font-size: 18px; margin-top: 5px; margin-bottom: 20px; color: #333; font-weight: normal; }
    .meta { text-align: center; font-size: 13px; margin-bottom: 30px; color: #555; }
    .page-break { page-break-after: always; }
    .event-container { margin-bottom: 0; padding-top: 10px; }
    
    .heat-header { 
        display: flex; 
        justify-content: space-between; 
        align-items: baseline;
        border-bottom: 2px solid #000;
        margin-top: 20px;
        margin-bottom: 10px;
        padding-bottom: 5px;
    }
    .heat-title { font-size: 16px; font-weight: bold; }
    .heat-time { font-size: 14px; }

    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px; }
    th { border-bottom: 2px solid #000; text-align: left; padding: 6px 4px; font-weight: bold; }
    td { border-bottom: 1px solid #ccc; padding: 6px 4px; vertical-align: middle; }
    
    /* Protocol specific */
    .col-rank, .col-lane, .col-bib { width: 40px; text-align: center; }
    .col-result { width: 100px; }
    .col-remarks { width: 100px; }
    .col-wind { width: 60px; }
    
    .footer { margin-top: 60px; display: flex; justify-content: space-around; font-size: 14px; page-break-inside: avoid; }
    .signature-box { display: flex; flex-direction: column; align-items: center; gap: 5px; width: 40%; }
    .signature-line { border-top: 1px solid #000; width: 100%; height: 1px; margin-top: 40px; }
    
    @media print { 
        body { padding: 0; } 
        @page { margin: 1.5cm; }
    }
`;

const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
};

// --- DATA PREPARATION ---

const groupEntriesByHeat = (entries: any[]) => {
    // Sort logic in backend, but failsafe here
    const sorted = [...entries].sort((a, b) => (a.heat || 99) - (b.heat || 99) || (a.lane || 99) - (b.lane || 99));

    // Group
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

// Detect event type based on name
const getEventType = (eventName: string = ''): 'THROW' | 'HORIZONTAL_JUMP' | 'VERTICAL_JUMP' | 'TRACK' => {
    const name = eventName.toUpperCase();

    // Throws
    if (name.includes('KULA') || name.includes('DYSK') || name.includes('MŁOT') || name.includes('OSZCZEP') ||
        name.includes('SHOT') || name.includes('DISCUS') || name.includes('HAMMER') || name.includes('JAVELIN')) {
        return 'THROW';
    }

    // Horizontal jumps
    if (name.includes('W DAL') || name.includes('TRÓJSKOK') ||
        name.includes('LONG JUMP') || name.includes('TRIPLE JUMP')) {
        return 'HORIZONTAL_JUMP';
    }

    // Vertical jumps
    if (name.includes('WZWYŻ') || name.includes('TYCZKA') ||
        name.includes('HIGH JUMP') || name.includes('POLE VAULT')) {
        return 'VERTICAL_JUMP';
    }

    return 'TRACK';
};

// --- TEMPLATES ---

export const generateStartListHTML = (event: any, entries: any[], meeting: any) => {
    const { heats, noHeat } = groupEntriesByHeat(entries);
    const heatKeys = Object.keys(heats).map(Number).sort((a, b) => a - b);

    let html = `<div class="event-container">`;
    html += `<h1>${meeting.name}</h1>`;
    html += `<h2>${event.name} (${event.category || 'Open'})</h2>`;
    html += `<div class="meta">${meeting.location}, ${formatDate(meeting.date)}</div>`;

    const renderTable = (entriesList: any[], title: string) => {
        let content = `<div class="heat-header"><span class="heat-title">${title}</span></div>`;
        content += `<table>
            <thead>
                <tr>
                    <th class="col-lane">Tor/Kol</th>
                    <th class="col-bib">Nr</th>
                    <th>Zawodnik</th>
                    <th>Klub</th>
                    <th style="width: 80px; text-align: center;">PB</th>
                    <th style="width: 80px; text-align: center;">SB</th>
                </tr>
            </thead>
            <tbody>`;

        entriesList.forEach(e => {
            content += `<tr>
                <td class="col-lane">${e.lane || '-'}</td>
                <td class="col-bib">${e.bib || ''}</td>
                <td><strong>${e.athleteName}</strong></td>
                <td>${e.club || ''}</td>
                <td style="text-align: center;">${e.pb || ''}</td>
                <td style="text-align: center;">${e.sb || ''}</td>
            </tr>`;
        });

        content += `</tbody></table>`;
        return content;
    };

    heatKeys.forEach(heat => {
        html += renderTable(heats[heat], `Seria ${heat}`);
    });

    if (noHeat.length > 0) {
        html += renderTable(noHeat, `Lista Zgłoszeń (Bez serii)`);
    }

    html += `</div>`;
    return html;
};

export const generateProtocolHTML = (event: any, entries: any[], meeting: any) => {
    const eventType = getEventType(event.name);
    const { heats, noHeat } = groupEntriesByHeat(entries);
    const heatKeys = Object.keys(heats).map(Number).sort((a, b) => a - b);

    let html = `<div class="event-container">`;
    html += `<h1>${meeting.name}</h1>`;
    html += `<h2>PROTOKÓŁ SĘDZIOWSKI - ${event.name}</h2>`;
    html += `<div class="meta">${meeting.location}, ${formatDate(meeting.date)}</div>`;

    // --- TRACK PROTOCOL ---
    const renderTrackProtocol = (entriesList: any[], title: string) => {
        let content = `<div class="heat-header">
            <span class="heat-title">${title}</span>
            <span class="heat-time">Start: ............ : ............</span>
        </div>`;

        content += `<table>
            <thead>
                <tr>
                    <th class="col-lane">Tor</th>
                    <th class="col-bib">Nr</th>
                    <th>Zawodnik / Klub</th>
                    <th class="col-result">Wynik</th>
                    <th class="col-wind">Wiatr</th>
                    <th class="col-rank">Msc</th>
                    <th class="col-remarks">Uwagi</th>
                </tr>
            </thead>
            <tbody>`;

        entriesList.forEach((e, idx) => {
            content += `<tr style="height: 35px;">
                <td class="col-lane">${e.lane || (idx + 1)}</td>
                <td class="col-bib">${e.bib || ''}</td>
                <td>
                    <div style="font-weight: bold;">${e.athleteName}</div>
                    <div style="font-size: 11px; color: #555;">${e.club || ''}</div>
                </td>
                <td class="col-result"></td>
                <td class="col-wind"></td>
                <td class="col-rank"></td>
                <td class="col-remarks"></td>
            </tr>`;
        });

        content += `</tbody></table>`;
        return content;
    };

    // --- THROWS & HORIZONTAL JUMPS PROTOCOL (6 trials) ---
    const renderTrialsProtocol = (entriesList: any[], title: string) => {
        let content = `<div class="heat-header">
            <span class="heat-title">${title}</span>
            <span class="heat-time">Start: ............ : ............</span>
        </div>`;

        content += `<table>
            <thead>
                <tr>
                    <th class="col-lane">Lp.</th>
                    <th class="col-bib">Nr</th>
                    <th>Zawodnik / Klub</th>
                    <th style="width: 50px; text-align: center;">1</th>
                    <th style="width: 50px; text-align: center;">2</th>
                    <th style="width: 50px; text-align: center;">3</th>
                    <th style="width: 50px; text-align: center;">4</th>
                    <th style="width: 50px; text-align: center;">5</th>
                    <th style="width: 50px; text-align: center;">6</th>
                    <th style="width: 60px; text-align: center;">Najl.</th>
                    <th class="col-rank">Msc</th>
                </tr>
            </thead>
            <tbody>`;

        entriesList.forEach((e, idx) => {
            content += `<tr style="height: 35px;">
                <td class="col-lane">${idx + 1}</td>
                <td class="col-bib">${e.bib || ''}</td>
                <td>
                    <div style="font-weight: bold;">${e.athleteName}</div>
                    <div style="font-size: 11px; color: #555;">${e.club || ''}</div>
                </td>
                <td style="text-align: center;"></td>
                <td style="text-align: center;"></td>
                <td style="text-align: center;"></td>
                <td style="text-align: center;"></td>
                <td style="text-align: center;"></td>
                <td style="text-align: center;"></td>
                <td style="text-align: center; font-weight: bold;"></td>
                <td class="col-rank"></td>
            </tr>`;
        });

        content += `</tbody></table>`;
        return content;
    };

    // --- VERTICAL JUMPS PROTOCOL (Heights) ---
    const renderVerticalJumpProtocol = (entriesList: any[], title: string) => {
        let content = `<div class="heat-header">
            <span class="heat-title">${title}</span>
            <span class="heat-time">Start: ............ : ............</span>
        </div>`;

        // Generate example heights (should be configurable, but for now show placeholders)
        const exampleHeights = ['1.40', '1.45', '1.50', '1.55', '1.60', '1.65', '1.70'];

        content += `<table>
            <thead>
                <tr>
                    <th class="col-lane">Lp.</th>
                    <th class="col-bib">Nr</th>
                    <th>Zawodnik / Klub</th>
                    ${exampleHeights.map(h => `<th style="width: 45px; text-align: center;">${h}</th>`).join('')}
                    <th style="width: 60px; text-align: center;">Wynik</th>
                    <th class="col-rank">Msc</th>
                </tr>
            </thead>
            <tbody>`;

        entriesList.forEach((e, idx) => {
            content += `<tr style="height: 35px;">
                <td class="col-lane">${idx + 1}</td>
                <td class="col-bib">${e.bib || ''}</td>
                <td>
                    <div style="font-weight: bold;">${e.athleteName}</div>
                    <div style="font-size: 11px; color: #555;">${e.club || ''}</div>
                </td>
                ${exampleHeights.map(() => `<td style="text-align: center;"></td>`).join('')}
                <td style="text-align: center; font-weight: bold;"></td>
                <td class="col-rank"></td>
            </tr>`;
        });

        content += `</tbody></table>`;
        content += `<div style="margin-top: 10px; font-size: 11px; color: #666;">
            <p>O = sukces, X = nieudana próba, - = rezygnacja</p>
        </div>`;
        return content;
    };

    // Render appropriate protocol based on event type
    const renderProtocol = (entriesList: any[], title: string) => {
        switch (eventType) {
            case 'THROW':
            case 'HORIZONTAL_JUMP':
                return renderTrialsProtocol(entriesList, title);
            case 'VERTICAL_JUMP':
                return renderVerticalJumpProtocol(entriesList, title);
            case 'TRACK':
            default:
                return renderTrackProtocol(entriesList, title);
        }
    };

    heatKeys.forEach(heat => {
        html += renderProtocol(heats[heat], `Seria ${heat}`);
        html += `<div style="margin-bottom: 30px;"></div>`;
    });

    if (noHeat.length > 0) {
        html += renderProtocol(noHeat, `Lista Startowa`);
    }

    // Signatures footer
    html += `
        <div class="footer">
            <div class="signature-box">
                <div class="signature-line"></div>
                <div>Sędzia ${eventType === 'TRACK' ? 'Celowniczy / Pomiar Czasu' : 'Główny Konkurencji'}</div>
            </div>
            <div class="signature-box">
                <div class="signature-line"></div>
                <div>Sędzia Główny</div>
            </div>
        </div>
    `;

    html += `</div>`;
    return html;
};

// --- MAIN FUNCTION ---

export const printBatch = async (meetingId: string, type: 'START_LIST' | 'PROTOCOL') => {
    try {
        const response = await api.get(`/meetings/${meetingId}/print-data`);
        const meeting = response.data;

        if (!meeting || !meeting.events || meeting.events.length === 0) {
            alert('Brak danych do wydruku.');
            return;
        }

        let content = '';

        // Filter events that have entries?
        // Usually we want to print empty lists too if they exist in schedule?
        // Let's print all events, even empty ones (headers only).

        meeting.events.forEach((event: any, index: number) => {
            const eventEntries = event.entries || [];

            if (type === 'START_LIST') {
                content += generateStartListHTML(event, eventEntries, meeting);
            } else {
                content += generateProtocolHTML(event, eventEntries, meeting);
            }

            if (index < meeting.events.length - 1) {
                content += '<div class="page-break"></div>';
            }
        });

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Zablokowano wyskakujące okno. Zezwól na pop-upy.');
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${type === 'START_LIST' ? 'Listy Startowe' : 'Protokoły Sędziowskie'}</title>
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
        console.error("Error printing batch", e);
        alert("Wystąpił błąd podczas generowania wydruku.");
    }
};

// Helper for printing single event from Entries Table (reusing logic)
export const printSingle = (event: any, entries: any[], meeting: any, type: 'START_LIST' | 'PROTOCOL') => {
    let content = '';
    if (type === 'START_LIST') {
        content = generateStartListHTML(event, entries, meeting);
    } else {
        content = generateProtocolHTML(event, entries, meeting);
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${type === 'START_LIST' ? 'Lista Startowa' : 'Protokół'}</title>
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
