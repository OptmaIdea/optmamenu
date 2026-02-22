export interface ProductStock {
    id: string;
    name: string;
    price: number;
    image_url: string;
    physical_stock: number;
    reserved_stock: number;
    available_stock: number;
}

export interface SecurityLog {
    id: string;
    created_at: string;
    action: string;
    user_email: string;
    details: any;
    outcome: 'success' | 'failure';
}

export interface FAQItem {
    question: string;
    answer: string;
    category: string;
}
