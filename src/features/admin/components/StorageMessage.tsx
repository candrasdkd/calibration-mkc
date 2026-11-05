import { Text } from 'react-native';
import { Card } from '../../../components/ui';
import { styles } from '../styles/AdminStyles';

function StorageMessage({ message }: { message: string }) {
  return message ? <Card style={styles.warning}><Text style={styles.warningText}>{message}</Text></Card> : null;
}

export { StorageMessage };
