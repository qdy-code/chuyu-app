import type { GlobalThemeOverrides } from 'naive-ui';

// 主色采用克制的暖珊瑚红 — 与小程序的红色系呼应，但更柔和、更现代
// 留白和层次靠浅米白 / 暖灰 / 边框过渡，避免传统后台的"工具栏蓝灰"廉价感
export const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#D8514F',
    primaryColorHover: '#C03F3D',
    primaryColorPressed: '#A93432',
    primaryColorSuppl: '#D8514F',
    infoColor: '#5B7CFA',
    successColor: '#3FA66E',
    warningColor: '#E2934A',
    errorColor: '#D45852',
    bodyColor: '#FAFAF7',
    cardColor: '#FFFFFF',
    modalColor: '#FFFFFF',
    popoverColor: '#FFFFFF',
    textColorBase: '#1F1D1B',
    textColor1: '#1F1D1B',
    textColor2: '#403B36',
    textColor3: '#7A726B',
    placeholderColor: '#B5ACA3',
    borderColor: '#ECE7E0',
    dividerColor: '#F0EBE3',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Segoe UI", Roboto, sans-serif',
    fontSize: '14px',
    fontSizeSmall: '13px',
    fontSizeMedium: '14px',
    fontSizeLarge: '15px',
    borderRadius: '8px',
    borderRadiusSmall: '6px',
  },
  Card: {
    paddingMedium: '20px 24px',
    paddingLarge: '24px 28px',
    titleFontSizeMedium: '16px',
    titleFontWeight: '600',
    borderColor: '#ECE7E0',
  },
  Button: {
    fontWeight: '500',
    borderRadiusMedium: '8px',
    heightMedium: '36px',
  },
  Tag: {
    borderRadius: '6px',
  },
  Layout: {
    siderColor: '#FFFFFF',
    color: '#FAFAF7',
    headerColor: '#FFFFFF',
    headerBorderColor: '#ECE7E0',
    siderBorderColor: '#ECE7E0',
  },
  Menu: {
    itemHeight: '44px',
    itemColorActive: 'rgba(216, 81, 79, 0.08)',
    itemColorActiveHover: 'rgba(216, 81, 79, 0.12)',
    itemColorActiveCollapsed: 'rgba(216, 81, 79, 0.08)',
    itemTextColorActive: '#D8514F',
    itemTextColorActiveHover: '#D8514F',
    itemIconColorActive: '#D8514F',
    itemIconColorActiveHover: '#D8514F',
    borderRadius: '8px',
  },
  DataTable: {
    thColor: '#FAF8F4',
    thFontWeight: '600',
    thTextColor: '#403B36',
    tdColor: '#FFFFFF',
    borderColor: '#F0EBE3',
    borderRadius: '10px',
  },
  Input: {
    borderRadius: '8px',
    border: '1px solid #ECE7E0',
    borderHover: '1px solid #D8514F',
    borderFocus: '1px solid #D8514F',
    boxShadowFocus: '0 0 0 2px rgba(216, 81, 79, 0.16)',
  },
  Modal: {
    peers: {
      Card: {
        borderRadius: '14px',
      },
    },
  },
  Statistic: {
    valueFontWeight: '700',
    valuePrefixTextColor: '#7A726B',
  },
};
