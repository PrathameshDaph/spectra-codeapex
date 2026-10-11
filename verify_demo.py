import urllib.request
import json

def test():
    data = json.dumps({
        'name': 'Verification Test Run',
        'scenario_type': 'severe_nlos',
        'duration_epochs': 60,
        'noise_sigma': 0.25,
        'nlos_bias': 2.8,
        'packet_loss_rate': 0.08,
        'disabled_anchors': [],
        'random_seed': 42
    }).encode('utf-8')

    req = urllib.request.Request(
        'http://127.0.0.1:8000/api/benchmark/run',
        data=data,
        headers={'Content-Type': 'application/json'}
    )
    res = json.loads(urllib.request.urlopen(req).read())
    print('=== BENCHMARK RESULT ===')
    print('Run ID:', res.get('id'))
    ols_mae = res['ols_metrics']['mae']
    spec_mae = res['spectra_metrics']['mae']
    gain = ((ols_mae - spec_mae) / ols_mae) * 100
    print(f'OLS MAE: {ols_mae:.3f} m')
    print(f'SPECTRA MAE: {spec_mae:.3f} m')
    print(f'Empirical Error Reduction: {gain:.1f}%')
    print('Key finding:', res['key_findings'][0])

    req_list = urllib.request.urlopen('http://127.0.0.1:8000/api/experiments')
    exp_list = json.loads(req_list.read())
    print(f'\n=== EXPERIMENTS IN SQLITE (Total: {len(exp_list)}) ===')
    for exp in exp_list:
        print(f"  ID {exp['id']}: {exp['name']} | OLS: {exp['mae_ols']:.3f}m -> SPECTRA: {exp['mae_spectra']:.3f}m (+{exp['improvement_pct']:.1f}%)")

if __name__ == '__main__':
    test()
