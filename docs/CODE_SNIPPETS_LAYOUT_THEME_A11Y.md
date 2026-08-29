# Code Snippets: Layout, Theme, and Accessibility

## Layout patterns

### Simple grid page

```tsx
<PageContainer title="My Page">
  <Grid columns={2} gap="normal">
    {items.map(item => (
      <Card key={item.id}>{item.title}</Card>
    ))}
  </Grid>
</PageContainer>
```

### Sectioned dashboard

```tsx
<PageContainer title="Dashboard" spacing="spacious">
  <Grid columns={4} gap="normal">
    <StatCard title="Lists" value={stats.lists} />
    <StatCard title="Tasks" value={stats.tasks} />
    <StatCard title="Done" value={stats.completed} />
    <StatCard title="Progress" value={`${stats.percent}%`} />
  </Grid>

  <Section title="Recent Items">
    <Grid columns={3} gap="normal">
      {items.map(item => (
        <ItemCard key={item.id} item={item} />
      ))}
    </Grid>
  </Section>
</PageContainer>
```

## Theme token usage

```tsx
// Avoid hardcoded colors.
<div className="bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] border border-[var(--color-border-default)]">
  <button className="bg-[var(--color-action-primary)] text-[var(--color-text-inverse)]">
    Click me
  </button>
</div>
```

## Semantic and ARIA patterns

```tsx
<section aria-label="Main content">
  <h1>My Page</h1>
  <article>
    <h2>Section Title</h2>
    <p>Content</p>
  </article>
</section>
```

```tsx
<div aria-live="polite" aria-busy={isLoading}>
  {isLoading && 'Loading...'}
</div>

<div role="progressbar" aria-valuenow={50} aria-valuemin={0} aria-valuemax={100}>
  <div style={{ width: '50%' }} />
</div>
```

## Keyboard accessibility essentials

```tsx
<button className="focus:outline-none focus:ring-2 focus:ring-[var(--color-action-primary)]">
  Click me
</button>

<a href="#main-content" className="sr-only">Skip to main content</a>
<main id="main-content">...</main>
```
