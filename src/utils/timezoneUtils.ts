export const timezoneUtils = {
    // Get current date in Brazil Time (useful for comparisons like "is today")
    getBrazilDate: (): Date => {
        const now = new Date();
        // Convert to Brazil time (UTC-3)
        // We use 'en-US' with 'America/Sao_Paulo' to get the correct components
        const brazilTimeStr = now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
        return new Date(brazilTimeStr);
    },

    // Format a date string (ISO or Date object) to Brazil format (DD/MM/YYYY HH:mm)
    formatBrazilDateTime: (dateInput: string | Date | null | undefined): string => {
        if (!dateInput) return '-';



        let date: Date;
        if (typeof dateInput === 'string') {
            let cleanInput = dateInput.replace(' ', 'T');
            // 1. If it doesn't have an explicit timezone, append Brazil's timezone
            if (!cleanInput.includes('Z') && !cleanInput.match(/[+-]\d{2}:?\d{2}$/)) {
                cleanInput += '-03:00';
            }


            date = new Date(cleanInput);
        } else {
            date = dateInput;
        }



        // Format: DD/MM/YYYY HH:mm
        const formatted = date.toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });


        return formatted;
    },

    // Format just the date (DD/MM/YYYY)
    formatBrazilDate: (dateInput: string | Date | null | undefined): string => {
        if (!dateInput) return '-';

        // Fix for "YYYY-MM-DD" strings shifting to previous day due to UTC conversion
        if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            const [year, month, day] = dateInput.split('-');
            return `${day}/${month}/${year}`;
        }

        const date = new Date(dateInput);
        return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    },

    // Get current ISO string adjusted to Brazil Time (manually constructing if needed, or just use regular ISO and let DB handle)
    // Actually, usually we send UTC to DB.
    // But if we want to SAVE "local" time (not recommended but requested "saving 3 hours ahead" might mean they want -3 stored),
    // we should stick to UTC in DB and format on frontend.
    // The user said "saving 3 hours ahead", which is UTC relative to Brazil.
    // If they want to SEE correct time, we use the formatters above.
};
