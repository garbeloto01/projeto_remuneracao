// Gera Hash SHA-256 para senhas
export async function digestMessage(message) {
    if (window.crypto && window.crypto.subtle) {
        try {
            const msgUint8 = new TextEncoder().encode(message);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        } catch (e) { return simpleHashFallback(message); }
    } else { return simpleHashFallback(message); }
}

function simpleHashFallback(str) {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return "local_" + hash.toString(16);
}

// Formata Data
export const formatDate = (timestamp) => {
    return timestamp instanceof Date ? timestamp.toLocaleDateString('pt-BR') : '-';
};

// Formata Moeda
export const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

// Download CSV (Versão corrigida com acentos)
export const downloadCSV = (data, fileName) => {
    if (!data || data.length === 0) return alert("Sem dados para exportar.");
    
    let csvContent = "\uFEFF"; // BOM para acentos no Excel
    csvContent += "Mês Ref;Colaborador;Setor;Valor Base;Valor Total;Data Lançamento;Status;Detalhes\n";

    data.forEach(row => {
        const date = formatDate(row.createdAt);
        const details = (row.scores || []).map(s => `${s.name}: ${s.score}/${s.max}`).join(' | ');
        
        const line = [
            row.monthRef,
            row.employeeName,
            row.sectorName,
            (row.baseValue || 0).toFixed(2).replace('.', ','),
            (row.totalValue || 0).toFixed(2).replace('.', ','),
            date,
            row.status || 'OK',
            details
        ].map(field => String(field || '').replace(/;/g, ',')).join(';'); 
        
        csvContent += line + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};