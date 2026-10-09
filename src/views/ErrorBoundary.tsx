import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode; onHome: () => void }
type State = { error: Error | null }

/**
 * Keeps one broken screen from blanking the whole app: the top bar (Sao lưu, Tìm) stays usable and the data is untouched,
 * because a screen only reads the data and the last good copy was already saved.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State { return { error } }

  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Screen crashed', error, info.componentStack) }

  render() {
    if (!this.state.error) return this.props.children
    return <div className="page"><section className="card" role="alert">
      <h2>Màn hình này gặp lỗi</h2>
      <p>Dữ liệu của bạn không bị mất: lần lưu gần nhất vẫn còn, và nút <b>Sao lưu</b> ở thanh trên vẫn dùng được để quay lại bản cũ.</p>
      <p className="muted">Chi tiết kỹ thuật (gửi cho người hỗ trợ): {this.state.error.message}</p>
      <div className="row wrap">
        <button className="btn primary" onClick={() => this.setState({ error: null })}>Thử lại</button>
        <button className="btn" onClick={() => { this.setState({ error: null }); this.props.onHome() }}>Về trang chủ</button>
      </div>
    </section></div>
  }
}
