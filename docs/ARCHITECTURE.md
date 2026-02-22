# Architecture Documentation

## System Overview

OptmaMenu is a modern web-based point-of-sale and menu management system designed for small to medium-sized food service businesses. The system provides a complete solution for managing products, orders, customers, and loyalty programs.

## Technology Stack

### Frontend
- **React 18**: Modern UI library with hooks and functional components
- **TypeScript**: Type-safe JavaScript for better developer experience
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework for responsive design
- **Lucide React**: Icon library for consistent UI elements

### Backend & Infrastructure
- **Supabase**: Backend-as-a-Service platform providing:
  - **PostgreSQL Database**: Relational database for data storage
  - **Authentication**: User authentication and authorization
  - **Real-time Subscriptions**: Live data updates via WebSockets
  - **Storage**: File storage for product images
  - **Row Level Security (RLS)**: Database-level security policies

### State Management
- **Zustand**: Lightweight state management library

### Additional Libraries
- **Sonner**: Toast notifications
- **React Router**: Client-side routing
- **Date-fns**: Date manipulation utilities
- **Zod**: Schema validation for forms
- **Vitest**: Test runner and assertion library

## Architecture Patterns

### Component Architecture

```
src/
├── __tests__/          # Automated tests (Vitest)
├── components/         # Reusable UI components
│   ├── admin/         # Admin-specific components
│   ├── common/        # Shared components
│   ├── layouts/       # Layout components (Private, Public, Store)
│   └── mobile/        # Mobile-specific components
├── constants/          # Application constants
├── hooks/              # Shared custom React hooks
├── lib/                # Third-party library configurations
├── pages/              # Route-based page components
│   ├── createStore/   # Store creation page
│   ├── initial/       # Public pages (landing, auth, legal)
│   ├── private/       # Private admin pages
│   │   └── admin/     # Admin dashboard and management
│   │       ├── commercial/   # Business features (orders, customers, loyalty)
│   │       ├── dashboard/    # Dashboard, reports, activity
│   │       ├── products/     # Product, category, inventory management
│   │       ├── settings/     # Store settings, profile, security
│   │       └── support/      # Documentation, FAQ, legal
│   └── store/         # Customer-facing store pages
├── services/           # Business logic and API calls
├── store/              # State management (Zustand)
├── types/              # TypeScript type definitions
└── utils/              # Utility functions
```

### Feature-Based Organization

The admin section follows a domain-driven structure:

```
pages/private/admin/
├── commercial/      # Business operations
│   ├── customers/   # Customer management
│   ├── loyalty/     # Loyalty program configuration
│   ├── messages/    # Marketing messages
│   └── orders/      # Order management
├── dashboard/       # Analytics and monitoring
│   ├── Activity/    # Recent activity
│   ├── Alerts/      # System alerts
│   ├── Reports/     # Business reports
│   └── push/        # Push notifications
├── products/        # Product catalog management
│   ├── category/    # Category management module
│   ├── inventory/   # Inventory and stock movements
│   └── products/    # Product CRUD module
├── settings/        # Store configuration
│   ├── appearance/  # Visual settings
│   ├── hours/       # Business hours
│   ├── messages/    # Message templates
│   ├── profile/     # User profile
│   ├── security/    # Security settings
│   ├── storeSettings/ # Store details
│   └── users/       # User management
└── support/         # Help and documentation
```

### Module Structure

Each feature module follows a consistent pattern:

```
module-name/
├── components/      # Module-specific components
├── hooks/           # Module-specific hooks
├── types/           # TypeScript types for the module
├── utils/           # Module-specific utilities
└── ModulePage.tsx   # Main page component
```

### Data Flow

1. **User Interaction** → Component
2. **Component** → Custom Hook
3. **Custom Hook** → Service Layer
4. **Service Layer** → Supabase Client
5. **Supabase** → PostgreSQL Database
6. **Database** → Response back through layers
7. **Real-time Updates** → Supabase Realtime → Component refresh

### Real-time Updates

The system uses Supabase Realtime for live data synchronization:

```typescript
// Example: Order monitoring
supabase
  .channel('orders')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'orders' },
    (payload) => {
      // Handle real-time updates
    }
  )
  .subscribe()
```

## Database Architecture

### Supabase Schema Organization

Database schema files are organized in `supabase/schema/`:

```
supabase/schema/
├── functions/           # Stored procedures and RPC functions
│   ├── admin_schema.sql
│   ├── loyalty_schema.sql
│   └── schema.sql
├── policies/            # Row Level Security policies
│   └── fix_storage_policies.sql
├── seed/                # Seed data
│   └── seed.sql
└── tables/              # Table definitions and migrations
    ├── category_migration.sql
    ├── products_bucket_migration.sql
    └── create_stock_movements.sql
```

### Migrations

Version-controlled migrations in `supabase/migrations/`:
- Naming convention: `YYYYMMDDHHMMSS_description.sql`
- Automatically applied via Supabase CLI

### Core Tables

#### `stores`
- Store information and configuration
- Links to user account
- Contains branding and operational settings

#### `products`
- Product catalog
- Pricing and availability
- Category relationships
- Stock management

#### `categories`
- Product categorization
- Display order and visibility
- Category extras (additional items)

#### `orders`
- Customer orders
- Order status tracking
- Payment information
- Store association

#### `customers`
- Customer profiles
- Contact information
- Loyalty program enrollment

#### `fidelity_programs`
- Loyalty program configuration
- Points rules and rewards
- Tier definitions

#### `customer_points`
- Points balance tracking
- Transaction history
- Expiration management

#### `rewards`
- Available rewards
- Redemption rules
- Point costs

#### `stock_movements`
- Inventory tracking
- Movement history
- Adjustment records

#### `store_hours`
- Business hours configuration
- Special hours and holidays

### Database Functions

Key stored procedures:
- `register_stock_movement()`: Automatic stock tracking
- `cancel_order()`: Order cancellation with stock restoration
- `get_last_sale()`: Last sale date for products

## Security Model

### Authentication
- **Admin**: Email/password authentication
- **Customers**: Phone number with OTP verification
- **Session Management**: Supabase Auth handles tokens and sessions

### Authorization
- **Row Level Security (RLS)**: Database-level access control
- **Store Isolation**: Each store can only access its own data
- **Customer Privacy**: Customers can only view their own data

### Example RLS Policy
```sql
-- Customers can only see their own orders
CREATE POLICY "Customers can view own orders"
ON orders FOR SELECT
USING (auth.uid() = customer_id);
```

## State Management

### Local State
- **useState**: Component-level state
- **useEffect**: Side effects and data fetching
- **Custom Hooks**: Shared stateful logic (e.g., `useProducts`, `useCartStore`)

### Global State (Zustand)
The application uses Zustand for lightweight, boilerplate-free state management:

- **`useAuthStore`**: Admin authentication state and session
- **`useCartStore`**: Shopping cart state and operations
- **`useCustomerAuth`**: Customer authentication state

### Real-time State
- **Supabase Realtime**: Live data synchronization for orders and inventory

## Performance Optimizations

### Code Splitting
- Route-based code splitting with React Router
- Feature-based folder structure for lazy loading opportunities
- Dynamic imports for heavy components (e.g., product modals, reports)

### Caching
- Supabase client-side caching
- Browser storage for session data
- Zustand store persistence for cart state

### Image Optimization
- WebP format for product images (automated conversion via script)
- Responsive image loading
- CDN-ready asset structure via `public/assets/`

### Database Optimization
- Indexed queries on frequently accessed tables
- Materialized views for complex reports
- Efficient RLS policies to minimize query overhead

## Deployment Architecture

```
User Browser
    ↓
Vite Build (Static Assets)
    ↓
Hosting Platform (Vercel/Netlify)
    ↓
Supabase API
    ↓
PostgreSQL Database
```

## Service Layer Pattern

Services are organized by domain and provide a clean abstraction over Supabase:

```typescript
// src/services/customerService.ts
export const getCustomer = async (id: string) => {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data
}

// src/services/customerAuth.ts
export const loginWithOTP = async (phone: string) => {
  const { data, error } = await supabase.auth.signInWithOtp({
    phone,
  })
  if (error) throw error
  return data
}
```

### Service Organization
- **`customerService.ts`**: Customer CRUD operations
- **`customerAuth.ts`**: Customer authentication
- **`notificationService.ts`**: Push notifications and messaging

## Error Handling

### Client-Side
- Try-catch blocks for async operations
- Toast notifications for user feedback (Sonner)
- Error boundaries for component errors
- Form validation with Zod schemas

### Database-Side
- PostgreSQL constraints and validations
- RLS policies for security
- Triggers for data integrity (e.g., stock movements, last sale tracking)
- Stored procedures for complex operations

## Testing Strategy

### Unit Tests
- **Vitest**: Test runner and assertion library
- **React Testing Library**: Component testing
- Tests located in `src/__tests__/` mirroring source structure

### Test Coverage
- Store logic (e.g., `useCartStore`)
- Utility functions (e.g., `timezoneUtils`)
- Critical business logic hooks

### Future Testing Goals
- Integration tests for critical user flows
- E2E tests with Playwright or Cypress
- Visual regression tests with Storybook

## Future Considerations

### Scalability
- Multi-store support with tenant isolation (implemented)
- Horizontal scaling with Supabase
- CDN for static assets
- Database connection pooling optimization

### Features
- Advanced analytics and reporting dashboard
- Enhanced inventory management with predictions
- Mobile app (React Native or Flutter)
- Third-party integrations (payment gateways, delivery services)
- Advanced marketing automation (birthday campaigns, abandoned cart)

### Technical Improvements
- Implement CI/CD pipeline with GitHub Actions
- Add error tracking (Sentry)
- Performance monitoring and APM
- API documentation with OpenAPI/Swagger
- Component documentation with Storybook
- Internationalization (i18n) for multi-language support
