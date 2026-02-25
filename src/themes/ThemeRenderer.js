import MinimalTheme from './minimal';

export default function ThemeRenderer({ portfolio }) {
  switch (portfolio?.themeId) {
    case 'minimal':
    default:
      return <MinimalTheme portfolio={portfolio} />;
  }
}
