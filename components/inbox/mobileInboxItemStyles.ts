import { StyleSheet } from 'react-native'

export const styles = StyleSheet.create({
  topBar: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  roundButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButton: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    marginBottom: 18,
  },
  metaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  metaPill: {
    maxWidth: '100%',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  stack: {
    gap: 12,
  },
  panel: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 15,
  },
  loadingPanel: {
    gap: 12,
  },
  sectionBody: {
    marginTop: 12,
    gap: 14,
  },
  textBlock: {
    gap: 7,
  },
  preWrap: {
    flexShrink: 1,
  },
  diagnosticHeader: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  diagnosticCopy: {
    flex: 1,
    gap: 5,
  },
  scoreBadge: {
    width: 74,
    minHeight: 62,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  sampleNotice: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  explainGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  explainTile: {
    width: '48%',
    minHeight: 58,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  issueList: {
    gap: 8,
  },
  issueRow: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  issueTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  actionAdviceList: {
    gap: 8,
  },
  adviceRow: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
  },
  metricRows: {
    gap: 8,
  },
  metricRow: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 11,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  metricCopy: {
    flex: 1,
    gap: 4,
  },
  breakdownGroup: {
    gap: 8,
  },
  breakdownRows: {
    gap: 8,
  },
  breakdownRow: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 11,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rows: {
    gap: 12,
  },
  detailLine: {
    gap: 5,
  },
  detailLineCompact: {
    gap: 3,
  },
  detailLabel: {
    textTransform: 'uppercase',
  },
  refGroups: {
    gap: 16,
  },
  refGroup: {
    gap: 8,
  },
  refs: {
    gap: 7,
  },
  refRow: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  actionStack: {
    gap: 9,
  },
  snoozeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  snoozeChip: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  snoozeCancel: {
    minHeight: 34,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  detailAction: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorPanel: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 14,
    padding: 14,
  },
})
