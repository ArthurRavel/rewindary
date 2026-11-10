import { render } from 'preact';
import { watchPrivacy } from './receipt';
import { App } from './ui/App';
import './styles.css';

watchPrivacy();
render(<App />, document.getElementById('app')!);
