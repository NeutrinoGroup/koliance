// Code generated - DO NOT EDIT.
// This file is a generated binding and any manual changes will be lost.

package bindings

import (
	"errors"
	"math/big"
	"strings"

	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/event"
)

// Reference imports to suppress errors if they are not otherwise used.
var (
	_ = errors.New
	_ = big.NewInt
	_ = strings.NewReader
	_ = ethereum.NotFound
	_ = bind.Bind
	_ = common.Big1
	_ = types.BloomLookup
	_ = event.NewSubscription
	_ = abi.ConvertType
)

// IPositionManagerPosition is an auto generated low-level Go binding around an user-defined struct.
type IPositionManagerPosition struct {
	Owner             common.Address
	FeedId            [32]byte
	CollateralUsd     *big.Int
	SizeUsd           *big.Int
	PayoutCapUsd      *big.Int
	EntryPrice        *big.Int
	IsLong            bool
	OpenedAt          *big.Int
	EntryFundingIndex *big.Int
}

// IPositionManagerMetaData contains all meta data concerning the IPositionManager contract.
var IPositionManagerMetaData = &bind.MetaData{
	ABI: "[{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"internalType\":\"bytes32\",\"name\":\"feedId\",\"type\":\"bytes32\"},{\"indexed\":false,\"internalType\":\"int256\",\"name\":\"index\",\"type\":\"int256\"},{\"indexed\":false,\"internalType\":\"uint256\",\"name\":\"blockNumber\",\"type\":\"uint256\"},{\"indexed\":false,\"internalType\":\"int256\",\"name\":\"skewWad\",\"type\":\"int256\"}],\"name\":\"FundingAccrued\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"internalType\":\"uint256\",\"name\":\"positionId\",\"type\":\"uint256\"},{\"indexed\":false,\"internalType\":\"int256\",\"name\":\"amount\",\"type\":\"int256\"}],\"name\":\"FundingSettled\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"internalType\":\"uint256\",\"name\":\"positionId\",\"type\":\"uint256\"},{\"indexed\":true,\"internalType\":\"address\",\"name\":\"owner\",\"type\":\"address\"},{\"indexed\":false,\"internalType\":\"uint256\",\"name\":\"exitPrice\",\"type\":\"uint256\"},{\"indexed\":false,\"internalType\":\"int256\",\"name\":\"pnl\",\"type\":\"int256\"}],\"name\":\"PositionClosed\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"internalType\":\"uint256\",\"name\":\"positionId\",\"type\":\"uint256\"},{\"indexed\":true,\"internalType\":\"address\",\"name\":\"owner\",\"type\":\"address\"},{\"indexed\":true,\"internalType\":\"address\",\"name\":\"liquidator\",\"type\":\"address\"},{\"indexed\":false,\"internalType\":\"uint256\",\"name\":\"exitPrice\",\"type\":\"uint256\"},{\"indexed\":false,\"internalType\":\"uint256\",\"name\":\"reward\",\"type\":\"uint256\"}],\"name\":\"PositionLiquidated\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"internalType\":\"uint256\",\"name\":\"positionId\",\"type\":\"uint256\"},{\"indexed\":true,\"internalType\":\"address\",\"name\":\"owner\",\"type\":\"address\"},{\"indexed\":true,\"internalType\":\"bytes32\",\"name\":\"feedId\",\"type\":\"bytes32\"},{\"indexed\":false,\"internalType\":\"uint256\",\"name\":\"collateralUsd\",\"type\":\"uint256\"},{\"indexed\":false,\"internalType\":\"uint256\",\"name\":\"sizeUsd\",\"type\":\"uint256\"},{\"indexed\":false,\"internalType\":\"uint256\",\"name\":\"entryPrice\",\"type\":\"uint256\"},{\"indexed\":false,\"internalType\":\"bool\",\"name\":\"isLong\",\"type\":\"bool\"}],\"name\":\"PositionOpened\",\"type\":\"event\"},{\"inputs\":[{\"internalType\":\"bytes32\",\"name\":\"feedId\",\"type\":\"bytes32\"}],\"name\":\"accrueFunding\",\"outputs\":[{\"internalType\":\"int256\",\"name\":\"\",\"type\":\"int256\"}],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"closeFeeBps\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"positionId\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"minOutUsd\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"deadline\",\"type\":\"uint256\"},{\"internalType\":\"bytes[]\",\"name\":\"pythUpdateData\",\"type\":\"bytes[]\"}],\"name\":\"closePosition\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"bytes32\",\"name\":\"feedId\",\"type\":\"bytes32\"}],\"name\":\"cumulativeFundingIndex\",\"outputs\":[{\"internalType\":\"int256\",\"name\":\"\",\"type\":\"int256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"positionId\",\"type\":\"uint256\"}],\"name\":\"fundingOwed\",\"outputs\":[{\"internalType\":\"int256\",\"name\":\"\",\"type\":\"int256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"fundingRatePerBlockWad\",\"outputs\":[{\"internalType\":\"int256\",\"name\":\"\",\"type\":\"int256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"positionId\",\"type\":\"uint256\"}],\"name\":\"getPosition\",\"outputs\":[{\"components\":[{\"internalType\":\"address\",\"name\":\"owner\",\"type\":\"address\"},{\"internalType\":\"bytes32\",\"name\":\"feedId\",\"type\":\"bytes32\"},{\"internalType\":\"uint256\",\"name\":\"collateralUsd\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"sizeUsd\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"payoutCapUsd\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"entryPrice\",\"type\":\"uint256\"},{\"internalType\":\"bool\",\"name\":\"isLong\",\"type\":\"bool\"},{\"internalType\":\"uint256\",\"name\":\"openedAt\",\"type\":\"uint256\"},{\"internalType\":\"int256\",\"name\":\"entryFundingIndex\",\"type\":\"int256\"}],\"internalType\":\"structIPositionManager.Position\",\"name\":\"\",\"type\":\"tuple\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"positionId\",\"type\":\"uint256\"}],\"name\":\"isLiquidatable\",\"outputs\":[{\"internalType\":\"bool\",\"name\":\"\",\"type\":\"bool\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256[]\",\"name\":\"positionIds\",\"type\":\"uint256[]\"},{\"internalType\":\"bytes[]\",\"name\":\"pythUpdateData\",\"type\":\"bytes[]\"}],\"name\":\"liquidate\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"liquidatorRewardBps\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"bool\",\"name\":\"forWithdrawal\",\"type\":\"bool\"}],\"name\":\"lpLiabilityUsd\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"maintenanceMarginBps\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"maxLeverageBps\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"maxProfitBps\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"nextPositionId\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"openFeeBps\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"bytes32\",\"name\":\"feedId\",\"type\":\"bytes32\"}],\"name\":\"openInterest\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"longUsd\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"shortUsd\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"bytes32\",\"name\":\"feedId\",\"type\":\"bytes32\"},{\"internalType\":\"uint256\",\"name\":\"collateralAmount\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"leverageBps\",\"type\":\"uint256\"},{\"internalType\":\"bool\",\"name\":\"isLong\",\"type\":\"bool\"},{\"internalType\":\"bytes[]\",\"name\":\"pythUpdateData\",\"type\":\"bytes[]\"}],\"name\":\"openPosition\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"positionId\",\"type\":\"uint256\"}],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"sessionKey\",\"type\":\"address\"},{\"internalType\":\"bytes32\",\"name\":\"feedId\",\"type\":\"bytes32\"},{\"internalType\":\"uint256\",\"name\":\"collateralAmount\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"leverageBps\",\"type\":\"uint256\"},{\"internalType\":\"bool\",\"name\":\"isLong\",\"type\":\"bool\"},{\"internalType\":\"bytes[]\",\"name\":\"pythUpdateData\",\"type\":\"bytes[]\"}],\"name\":\"openPositionFor\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"positionId\",\"type\":\"uint256\"}],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"reservedAssets\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"registry\",\"type\":\"address\"}],\"name\":\"setSessionKeyRegistry\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"}]",
}

// IPositionManagerABI is the input ABI used to generate the binding from.
// Deprecated: Use IPositionManagerMetaData.ABI instead.
var IPositionManagerABI = IPositionManagerMetaData.ABI

// IPositionManager is an auto generated Go binding around an Ethereum contract.
type IPositionManager struct {
	IPositionManagerCaller     // Read-only binding to the contract
	IPositionManagerTransactor // Write-only binding to the contract
	IPositionManagerFilterer   // Log filterer for contract events
}

// IPositionManagerCaller is an auto generated read-only Go binding around an Ethereum contract.
type IPositionManagerCaller struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// IPositionManagerTransactor is an auto generated write-only Go binding around an Ethereum contract.
type IPositionManagerTransactor struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// IPositionManagerFilterer is an auto generated log filtering Go binding around an Ethereum contract events.
type IPositionManagerFilterer struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// IPositionManagerSession is an auto generated Go binding around an Ethereum contract,
// with pre-set call and transact options.
type IPositionManagerSession struct {
	Contract     *IPositionManager // Generic contract binding to set the session for
	CallOpts     bind.CallOpts     // Call options to use throughout this session
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// IPositionManagerCallerSession is an auto generated read-only Go binding around an Ethereum contract,
// with pre-set call options.
type IPositionManagerCallerSession struct {
	Contract *IPositionManagerCaller // Generic contract caller binding to set the session for
	CallOpts bind.CallOpts           // Call options to use throughout this session
}

// IPositionManagerTransactorSession is an auto generated write-only Go binding around an Ethereum contract,
// with pre-set transact options.
type IPositionManagerTransactorSession struct {
	Contract     *IPositionManagerTransactor // Generic contract transactor binding to set the session for
	TransactOpts bind.TransactOpts           // Transaction auth options to use throughout this session
}

// IPositionManagerRaw is an auto generated low-level Go binding around an Ethereum contract.
type IPositionManagerRaw struct {
	Contract *IPositionManager // Generic contract binding to access the raw methods on
}

// IPositionManagerCallerRaw is an auto generated low-level read-only Go binding around an Ethereum contract.
type IPositionManagerCallerRaw struct {
	Contract *IPositionManagerCaller // Generic read-only contract binding to access the raw methods on
}

// IPositionManagerTransactorRaw is an auto generated low-level write-only Go binding around an Ethereum contract.
type IPositionManagerTransactorRaw struct {
	Contract *IPositionManagerTransactor // Generic write-only contract binding to access the raw methods on
}

// NewIPositionManager creates a new instance of IPositionManager, bound to a specific deployed contract.
func NewIPositionManager(address common.Address, backend bind.ContractBackend) (*IPositionManager, error) {
	contract, err := bindIPositionManager(address, backend, backend, backend)
	if err != nil {
		return nil, err
	}
	return &IPositionManager{IPositionManagerCaller: IPositionManagerCaller{contract: contract}, IPositionManagerTransactor: IPositionManagerTransactor{contract: contract}, IPositionManagerFilterer: IPositionManagerFilterer{contract: contract}}, nil
}

// NewIPositionManagerCaller creates a new read-only instance of IPositionManager, bound to a specific deployed contract.
func NewIPositionManagerCaller(address common.Address, caller bind.ContractCaller) (*IPositionManagerCaller, error) {
	contract, err := bindIPositionManager(address, caller, nil, nil)
	if err != nil {
		return nil, err
	}
	return &IPositionManagerCaller{contract: contract}, nil
}

// NewIPositionManagerTransactor creates a new write-only instance of IPositionManager, bound to a specific deployed contract.
func NewIPositionManagerTransactor(address common.Address, transactor bind.ContractTransactor) (*IPositionManagerTransactor, error) {
	contract, err := bindIPositionManager(address, nil, transactor, nil)
	if err != nil {
		return nil, err
	}
	return &IPositionManagerTransactor{contract: contract}, nil
}

// NewIPositionManagerFilterer creates a new log filterer instance of IPositionManager, bound to a specific deployed contract.
func NewIPositionManagerFilterer(address common.Address, filterer bind.ContractFilterer) (*IPositionManagerFilterer, error) {
	contract, err := bindIPositionManager(address, nil, nil, filterer)
	if err != nil {
		return nil, err
	}
	return &IPositionManagerFilterer{contract: contract}, nil
}

// bindIPositionManager binds a generic wrapper to an already deployed contract.
func bindIPositionManager(address common.Address, caller bind.ContractCaller, transactor bind.ContractTransactor, filterer bind.ContractFilterer) (*bind.BoundContract, error) {
	parsed, err := IPositionManagerMetaData.GetAbi()
	if err != nil {
		return nil, err
	}
	return bind.NewBoundContract(address, *parsed, caller, transactor, filterer), nil
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_IPositionManager *IPositionManagerRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _IPositionManager.Contract.IPositionManagerCaller.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_IPositionManager *IPositionManagerRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _IPositionManager.Contract.IPositionManagerTransactor.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_IPositionManager *IPositionManagerRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _IPositionManager.Contract.IPositionManagerTransactor.contract.Transact(opts, method, params...)
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_IPositionManager *IPositionManagerCallerRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _IPositionManager.Contract.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_IPositionManager *IPositionManagerTransactorRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _IPositionManager.Contract.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_IPositionManager *IPositionManagerTransactorRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _IPositionManager.Contract.contract.Transact(opts, method, params...)
}

// CloseFeeBps is a free data retrieval call binding the contract method 0x0ba3d401.
//
// Solidity: function closeFeeBps() view returns(uint256)
func (_IPositionManager *IPositionManagerCaller) CloseFeeBps(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _IPositionManager.contract.Call(opts, &out, "closeFeeBps")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// CloseFeeBps is a free data retrieval call binding the contract method 0x0ba3d401.
//
// Solidity: function closeFeeBps() view returns(uint256)
func (_IPositionManager *IPositionManagerSession) CloseFeeBps() (*big.Int, error) {
	return _IPositionManager.Contract.CloseFeeBps(&_IPositionManager.CallOpts)
}

// CloseFeeBps is a free data retrieval call binding the contract method 0x0ba3d401.
//
// Solidity: function closeFeeBps() view returns(uint256)
func (_IPositionManager *IPositionManagerCallerSession) CloseFeeBps() (*big.Int, error) {
	return _IPositionManager.Contract.CloseFeeBps(&_IPositionManager.CallOpts)
}

// CumulativeFundingIndex is a free data retrieval call binding the contract method 0x4655f1eb.
//
// Solidity: function cumulativeFundingIndex(bytes32 feedId) view returns(int256)
func (_IPositionManager *IPositionManagerCaller) CumulativeFundingIndex(opts *bind.CallOpts, feedId [32]byte) (*big.Int, error) {
	var out []interface{}
	err := _IPositionManager.contract.Call(opts, &out, "cumulativeFundingIndex", feedId)

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// CumulativeFundingIndex is a free data retrieval call binding the contract method 0x4655f1eb.
//
// Solidity: function cumulativeFundingIndex(bytes32 feedId) view returns(int256)
func (_IPositionManager *IPositionManagerSession) CumulativeFundingIndex(feedId [32]byte) (*big.Int, error) {
	return _IPositionManager.Contract.CumulativeFundingIndex(&_IPositionManager.CallOpts, feedId)
}

// CumulativeFundingIndex is a free data retrieval call binding the contract method 0x4655f1eb.
//
// Solidity: function cumulativeFundingIndex(bytes32 feedId) view returns(int256)
func (_IPositionManager *IPositionManagerCallerSession) CumulativeFundingIndex(feedId [32]byte) (*big.Int, error) {
	return _IPositionManager.Contract.CumulativeFundingIndex(&_IPositionManager.CallOpts, feedId)
}

// FundingOwed is a free data retrieval call binding the contract method 0xf6c1843e.
//
// Solidity: function fundingOwed(uint256 positionId) view returns(int256)
func (_IPositionManager *IPositionManagerCaller) FundingOwed(opts *bind.CallOpts, positionId *big.Int) (*big.Int, error) {
	var out []interface{}
	err := _IPositionManager.contract.Call(opts, &out, "fundingOwed", positionId)

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// FundingOwed is a free data retrieval call binding the contract method 0xf6c1843e.
//
// Solidity: function fundingOwed(uint256 positionId) view returns(int256)
func (_IPositionManager *IPositionManagerSession) FundingOwed(positionId *big.Int) (*big.Int, error) {
	return _IPositionManager.Contract.FundingOwed(&_IPositionManager.CallOpts, positionId)
}

// FundingOwed is a free data retrieval call binding the contract method 0xf6c1843e.
//
// Solidity: function fundingOwed(uint256 positionId) view returns(int256)
func (_IPositionManager *IPositionManagerCallerSession) FundingOwed(positionId *big.Int) (*big.Int, error) {
	return _IPositionManager.Contract.FundingOwed(&_IPositionManager.CallOpts, positionId)
}

// FundingRatePerBlockWad is a free data retrieval call binding the contract method 0x56ddfc44.
//
// Solidity: function fundingRatePerBlockWad() view returns(int256)
func (_IPositionManager *IPositionManagerCaller) FundingRatePerBlockWad(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _IPositionManager.contract.Call(opts, &out, "fundingRatePerBlockWad")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// FundingRatePerBlockWad is a free data retrieval call binding the contract method 0x56ddfc44.
//
// Solidity: function fundingRatePerBlockWad() view returns(int256)
func (_IPositionManager *IPositionManagerSession) FundingRatePerBlockWad() (*big.Int, error) {
	return _IPositionManager.Contract.FundingRatePerBlockWad(&_IPositionManager.CallOpts)
}

// FundingRatePerBlockWad is a free data retrieval call binding the contract method 0x56ddfc44.
//
// Solidity: function fundingRatePerBlockWad() view returns(int256)
func (_IPositionManager *IPositionManagerCallerSession) FundingRatePerBlockWad() (*big.Int, error) {
	return _IPositionManager.Contract.FundingRatePerBlockWad(&_IPositionManager.CallOpts)
}

// GetPosition is a free data retrieval call binding the contract method 0xeb02c301.
//
// Solidity: function getPosition(uint256 positionId) view returns((address,bytes32,uint256,uint256,uint256,uint256,bool,uint256,int256))
func (_IPositionManager *IPositionManagerCaller) GetPosition(opts *bind.CallOpts, positionId *big.Int) (IPositionManagerPosition, error) {
	var out []interface{}
	err := _IPositionManager.contract.Call(opts, &out, "getPosition", positionId)

	if err != nil {
		return *new(IPositionManagerPosition), err
	}

	out0 := *abi.ConvertType(out[0], new(IPositionManagerPosition)).(*IPositionManagerPosition)

	return out0, err

}

// GetPosition is a free data retrieval call binding the contract method 0xeb02c301.
//
// Solidity: function getPosition(uint256 positionId) view returns((address,bytes32,uint256,uint256,uint256,uint256,bool,uint256,int256))
func (_IPositionManager *IPositionManagerSession) GetPosition(positionId *big.Int) (IPositionManagerPosition, error) {
	return _IPositionManager.Contract.GetPosition(&_IPositionManager.CallOpts, positionId)
}

// GetPosition is a free data retrieval call binding the contract method 0xeb02c301.
//
// Solidity: function getPosition(uint256 positionId) view returns((address,bytes32,uint256,uint256,uint256,uint256,bool,uint256,int256))
func (_IPositionManager *IPositionManagerCallerSession) GetPosition(positionId *big.Int) (IPositionManagerPosition, error) {
	return _IPositionManager.Contract.GetPosition(&_IPositionManager.CallOpts, positionId)
}

// IsLiquidatable is a free data retrieval call binding the contract method 0x211a4443.
//
// Solidity: function isLiquidatable(uint256 positionId) view returns(bool)
func (_IPositionManager *IPositionManagerCaller) IsLiquidatable(opts *bind.CallOpts, positionId *big.Int) (bool, error) {
	var out []interface{}
	err := _IPositionManager.contract.Call(opts, &out, "isLiquidatable", positionId)

	if err != nil {
		return *new(bool), err
	}

	out0 := *abi.ConvertType(out[0], new(bool)).(*bool)

	return out0, err

}

// IsLiquidatable is a free data retrieval call binding the contract method 0x211a4443.
//
// Solidity: function isLiquidatable(uint256 positionId) view returns(bool)
func (_IPositionManager *IPositionManagerSession) IsLiquidatable(positionId *big.Int) (bool, error) {
	return _IPositionManager.Contract.IsLiquidatable(&_IPositionManager.CallOpts, positionId)
}

// IsLiquidatable is a free data retrieval call binding the contract method 0x211a4443.
//
// Solidity: function isLiquidatable(uint256 positionId) view returns(bool)
func (_IPositionManager *IPositionManagerCallerSession) IsLiquidatable(positionId *big.Int) (bool, error) {
	return _IPositionManager.Contract.IsLiquidatable(&_IPositionManager.CallOpts, positionId)
}

// LiquidatorRewardBps is a free data retrieval call binding the contract method 0x5ac35a26.
//
// Solidity: function liquidatorRewardBps() view returns(uint256)
func (_IPositionManager *IPositionManagerCaller) LiquidatorRewardBps(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _IPositionManager.contract.Call(opts, &out, "liquidatorRewardBps")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// LiquidatorRewardBps is a free data retrieval call binding the contract method 0x5ac35a26.
//
// Solidity: function liquidatorRewardBps() view returns(uint256)
func (_IPositionManager *IPositionManagerSession) LiquidatorRewardBps() (*big.Int, error) {
	return _IPositionManager.Contract.LiquidatorRewardBps(&_IPositionManager.CallOpts)
}

// LiquidatorRewardBps is a free data retrieval call binding the contract method 0x5ac35a26.
//
// Solidity: function liquidatorRewardBps() view returns(uint256)
func (_IPositionManager *IPositionManagerCallerSession) LiquidatorRewardBps() (*big.Int, error) {
	return _IPositionManager.Contract.LiquidatorRewardBps(&_IPositionManager.CallOpts)
}

// LpLiabilityUsd is a free data retrieval call binding the contract method 0xb27011f1.
//
// Solidity: function lpLiabilityUsd(bool forWithdrawal) view returns(uint256)
func (_IPositionManager *IPositionManagerCaller) LpLiabilityUsd(opts *bind.CallOpts, forWithdrawal bool) (*big.Int, error) {
	var out []interface{}
	err := _IPositionManager.contract.Call(opts, &out, "lpLiabilityUsd", forWithdrawal)

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// LpLiabilityUsd is a free data retrieval call binding the contract method 0xb27011f1.
//
// Solidity: function lpLiabilityUsd(bool forWithdrawal) view returns(uint256)
func (_IPositionManager *IPositionManagerSession) LpLiabilityUsd(forWithdrawal bool) (*big.Int, error) {
	return _IPositionManager.Contract.LpLiabilityUsd(&_IPositionManager.CallOpts, forWithdrawal)
}

// LpLiabilityUsd is a free data retrieval call binding the contract method 0xb27011f1.
//
// Solidity: function lpLiabilityUsd(bool forWithdrawal) view returns(uint256)
func (_IPositionManager *IPositionManagerCallerSession) LpLiabilityUsd(forWithdrawal bool) (*big.Int, error) {
	return _IPositionManager.Contract.LpLiabilityUsd(&_IPositionManager.CallOpts, forWithdrawal)
}

// MaintenanceMarginBps is a free data retrieval call binding the contract method 0xa719f943.
//
// Solidity: function maintenanceMarginBps() view returns(uint256)
func (_IPositionManager *IPositionManagerCaller) MaintenanceMarginBps(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _IPositionManager.contract.Call(opts, &out, "maintenanceMarginBps")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// MaintenanceMarginBps is a free data retrieval call binding the contract method 0xa719f943.
//
// Solidity: function maintenanceMarginBps() view returns(uint256)
func (_IPositionManager *IPositionManagerSession) MaintenanceMarginBps() (*big.Int, error) {
	return _IPositionManager.Contract.MaintenanceMarginBps(&_IPositionManager.CallOpts)
}

// MaintenanceMarginBps is a free data retrieval call binding the contract method 0xa719f943.
//
// Solidity: function maintenanceMarginBps() view returns(uint256)
func (_IPositionManager *IPositionManagerCallerSession) MaintenanceMarginBps() (*big.Int, error) {
	return _IPositionManager.Contract.MaintenanceMarginBps(&_IPositionManager.CallOpts)
}

// MaxLeverageBps is a free data retrieval call binding the contract method 0x60cc2392.
//
// Solidity: function maxLeverageBps() view returns(uint256)
func (_IPositionManager *IPositionManagerCaller) MaxLeverageBps(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _IPositionManager.contract.Call(opts, &out, "maxLeverageBps")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// MaxLeverageBps is a free data retrieval call binding the contract method 0x60cc2392.
//
// Solidity: function maxLeverageBps() view returns(uint256)
func (_IPositionManager *IPositionManagerSession) MaxLeverageBps() (*big.Int, error) {
	return _IPositionManager.Contract.MaxLeverageBps(&_IPositionManager.CallOpts)
}

// MaxLeverageBps is a free data retrieval call binding the contract method 0x60cc2392.
//
// Solidity: function maxLeverageBps() view returns(uint256)
func (_IPositionManager *IPositionManagerCallerSession) MaxLeverageBps() (*big.Int, error) {
	return _IPositionManager.Contract.MaxLeverageBps(&_IPositionManager.CallOpts)
}

// MaxProfitBps is a free data retrieval call binding the contract method 0x7c432c9f.
//
// Solidity: function maxProfitBps() view returns(uint256)
func (_IPositionManager *IPositionManagerCaller) MaxProfitBps(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _IPositionManager.contract.Call(opts, &out, "maxProfitBps")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// MaxProfitBps is a free data retrieval call binding the contract method 0x7c432c9f.
//
// Solidity: function maxProfitBps() view returns(uint256)
func (_IPositionManager *IPositionManagerSession) MaxProfitBps() (*big.Int, error) {
	return _IPositionManager.Contract.MaxProfitBps(&_IPositionManager.CallOpts)
}

// MaxProfitBps is a free data retrieval call binding the contract method 0x7c432c9f.
//
// Solidity: function maxProfitBps() view returns(uint256)
func (_IPositionManager *IPositionManagerCallerSession) MaxProfitBps() (*big.Int, error) {
	return _IPositionManager.Contract.MaxProfitBps(&_IPositionManager.CallOpts)
}

// NextPositionId is a free data retrieval call binding the contract method 0x899346c7.
//
// Solidity: function nextPositionId() view returns(uint256)
func (_IPositionManager *IPositionManagerCaller) NextPositionId(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _IPositionManager.contract.Call(opts, &out, "nextPositionId")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// NextPositionId is a free data retrieval call binding the contract method 0x899346c7.
//
// Solidity: function nextPositionId() view returns(uint256)
func (_IPositionManager *IPositionManagerSession) NextPositionId() (*big.Int, error) {
	return _IPositionManager.Contract.NextPositionId(&_IPositionManager.CallOpts)
}

// NextPositionId is a free data retrieval call binding the contract method 0x899346c7.
//
// Solidity: function nextPositionId() view returns(uint256)
func (_IPositionManager *IPositionManagerCallerSession) NextPositionId() (*big.Int, error) {
	return _IPositionManager.Contract.NextPositionId(&_IPositionManager.CallOpts)
}

// OpenFeeBps is a free data retrieval call binding the contract method 0x15d81b3a.
//
// Solidity: function openFeeBps() view returns(uint256)
func (_IPositionManager *IPositionManagerCaller) OpenFeeBps(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _IPositionManager.contract.Call(opts, &out, "openFeeBps")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// OpenFeeBps is a free data retrieval call binding the contract method 0x15d81b3a.
//
// Solidity: function openFeeBps() view returns(uint256)
func (_IPositionManager *IPositionManagerSession) OpenFeeBps() (*big.Int, error) {
	return _IPositionManager.Contract.OpenFeeBps(&_IPositionManager.CallOpts)
}

// OpenFeeBps is a free data retrieval call binding the contract method 0x15d81b3a.
//
// Solidity: function openFeeBps() view returns(uint256)
func (_IPositionManager *IPositionManagerCallerSession) OpenFeeBps() (*big.Int, error) {
	return _IPositionManager.Contract.OpenFeeBps(&_IPositionManager.CallOpts)
}

// OpenInterest is a free data retrieval call binding the contract method 0x31d860bc.
//
// Solidity: function openInterest(bytes32 feedId) view returns(uint256 longUsd, uint256 shortUsd)
func (_IPositionManager *IPositionManagerCaller) OpenInterest(opts *bind.CallOpts, feedId [32]byte) (struct {
	LongUsd  *big.Int
	ShortUsd *big.Int
}, error) {
	var out []interface{}
	err := _IPositionManager.contract.Call(opts, &out, "openInterest", feedId)

	outstruct := new(struct {
		LongUsd  *big.Int
		ShortUsd *big.Int
	})
	if err != nil {
		return *outstruct, err
	}

	outstruct.LongUsd = *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)
	outstruct.ShortUsd = *abi.ConvertType(out[1], new(*big.Int)).(**big.Int)

	return *outstruct, err

}

// OpenInterest is a free data retrieval call binding the contract method 0x31d860bc.
//
// Solidity: function openInterest(bytes32 feedId) view returns(uint256 longUsd, uint256 shortUsd)
func (_IPositionManager *IPositionManagerSession) OpenInterest(feedId [32]byte) (struct {
	LongUsd  *big.Int
	ShortUsd *big.Int
}, error) {
	return _IPositionManager.Contract.OpenInterest(&_IPositionManager.CallOpts, feedId)
}

// OpenInterest is a free data retrieval call binding the contract method 0x31d860bc.
//
// Solidity: function openInterest(bytes32 feedId) view returns(uint256 longUsd, uint256 shortUsd)
func (_IPositionManager *IPositionManagerCallerSession) OpenInterest(feedId [32]byte) (struct {
	LongUsd  *big.Int
	ShortUsd *big.Int
}, error) {
	return _IPositionManager.Contract.OpenInterest(&_IPositionManager.CallOpts, feedId)
}

// ReservedAssets is a free data retrieval call binding the contract method 0x3d302d06.
//
// Solidity: function reservedAssets() view returns(uint256)
func (_IPositionManager *IPositionManagerCaller) ReservedAssets(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _IPositionManager.contract.Call(opts, &out, "reservedAssets")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// ReservedAssets is a free data retrieval call binding the contract method 0x3d302d06.
//
// Solidity: function reservedAssets() view returns(uint256)
func (_IPositionManager *IPositionManagerSession) ReservedAssets() (*big.Int, error) {
	return _IPositionManager.Contract.ReservedAssets(&_IPositionManager.CallOpts)
}

// ReservedAssets is a free data retrieval call binding the contract method 0x3d302d06.
//
// Solidity: function reservedAssets() view returns(uint256)
func (_IPositionManager *IPositionManagerCallerSession) ReservedAssets() (*big.Int, error) {
	return _IPositionManager.Contract.ReservedAssets(&_IPositionManager.CallOpts)
}

// AccrueFunding is a paid mutator transaction binding the contract method 0x62c0ff14.
//
// Solidity: function accrueFunding(bytes32 feedId) returns(int256)
func (_IPositionManager *IPositionManagerTransactor) AccrueFunding(opts *bind.TransactOpts, feedId [32]byte) (*types.Transaction, error) {
	return _IPositionManager.contract.Transact(opts, "accrueFunding", feedId)
}

// AccrueFunding is a paid mutator transaction binding the contract method 0x62c0ff14.
//
// Solidity: function accrueFunding(bytes32 feedId) returns(int256)
func (_IPositionManager *IPositionManagerSession) AccrueFunding(feedId [32]byte) (*types.Transaction, error) {
	return _IPositionManager.Contract.AccrueFunding(&_IPositionManager.TransactOpts, feedId)
}

// AccrueFunding is a paid mutator transaction binding the contract method 0x62c0ff14.
//
// Solidity: function accrueFunding(bytes32 feedId) returns(int256)
func (_IPositionManager *IPositionManagerTransactorSession) AccrueFunding(feedId [32]byte) (*types.Transaction, error) {
	return _IPositionManager.Contract.AccrueFunding(&_IPositionManager.TransactOpts, feedId)
}

// ClosePosition is a paid mutator transaction binding the contract method 0x796f0ab3.
//
// Solidity: function closePosition(uint256 positionId, uint256 minOutUsd, uint256 deadline, bytes[] pythUpdateData) returns()
func (_IPositionManager *IPositionManagerTransactor) ClosePosition(opts *bind.TransactOpts, positionId *big.Int, minOutUsd *big.Int, deadline *big.Int, pythUpdateData [][]byte) (*types.Transaction, error) {
	return _IPositionManager.contract.Transact(opts, "closePosition", positionId, minOutUsd, deadline, pythUpdateData)
}

// ClosePosition is a paid mutator transaction binding the contract method 0x796f0ab3.
//
// Solidity: function closePosition(uint256 positionId, uint256 minOutUsd, uint256 deadline, bytes[] pythUpdateData) returns()
func (_IPositionManager *IPositionManagerSession) ClosePosition(positionId *big.Int, minOutUsd *big.Int, deadline *big.Int, pythUpdateData [][]byte) (*types.Transaction, error) {
	return _IPositionManager.Contract.ClosePosition(&_IPositionManager.TransactOpts, positionId, minOutUsd, deadline, pythUpdateData)
}

// ClosePosition is a paid mutator transaction binding the contract method 0x796f0ab3.
//
// Solidity: function closePosition(uint256 positionId, uint256 minOutUsd, uint256 deadline, bytes[] pythUpdateData) returns()
func (_IPositionManager *IPositionManagerTransactorSession) ClosePosition(positionId *big.Int, minOutUsd *big.Int, deadline *big.Int, pythUpdateData [][]byte) (*types.Transaction, error) {
	return _IPositionManager.Contract.ClosePosition(&_IPositionManager.TransactOpts, positionId, minOutUsd, deadline, pythUpdateData)
}

// Liquidate is a paid mutator transaction binding the contract method 0xbf987856.
//
// Solidity: function liquidate(uint256[] positionIds, bytes[] pythUpdateData) returns()
func (_IPositionManager *IPositionManagerTransactor) Liquidate(opts *bind.TransactOpts, positionIds []*big.Int, pythUpdateData [][]byte) (*types.Transaction, error) {
	return _IPositionManager.contract.Transact(opts, "liquidate", positionIds, pythUpdateData)
}

// Liquidate is a paid mutator transaction binding the contract method 0xbf987856.
//
// Solidity: function liquidate(uint256[] positionIds, bytes[] pythUpdateData) returns()
func (_IPositionManager *IPositionManagerSession) Liquidate(positionIds []*big.Int, pythUpdateData [][]byte) (*types.Transaction, error) {
	return _IPositionManager.Contract.Liquidate(&_IPositionManager.TransactOpts, positionIds, pythUpdateData)
}

// Liquidate is a paid mutator transaction binding the contract method 0xbf987856.
//
// Solidity: function liquidate(uint256[] positionIds, bytes[] pythUpdateData) returns()
func (_IPositionManager *IPositionManagerTransactorSession) Liquidate(positionIds []*big.Int, pythUpdateData [][]byte) (*types.Transaction, error) {
	return _IPositionManager.Contract.Liquidate(&_IPositionManager.TransactOpts, positionIds, pythUpdateData)
}

// OpenPosition is a paid mutator transaction binding the contract method 0x0d5ef376.
//
// Solidity: function openPosition(bytes32 feedId, uint256 collateralAmount, uint256 leverageBps, bool isLong, bytes[] pythUpdateData) returns(uint256 positionId)
func (_IPositionManager *IPositionManagerTransactor) OpenPosition(opts *bind.TransactOpts, feedId [32]byte, collateralAmount *big.Int, leverageBps *big.Int, isLong bool, pythUpdateData [][]byte) (*types.Transaction, error) {
	return _IPositionManager.contract.Transact(opts, "openPosition", feedId, collateralAmount, leverageBps, isLong, pythUpdateData)
}

// OpenPosition is a paid mutator transaction binding the contract method 0x0d5ef376.
//
// Solidity: function openPosition(bytes32 feedId, uint256 collateralAmount, uint256 leverageBps, bool isLong, bytes[] pythUpdateData) returns(uint256 positionId)
func (_IPositionManager *IPositionManagerSession) OpenPosition(feedId [32]byte, collateralAmount *big.Int, leverageBps *big.Int, isLong bool, pythUpdateData [][]byte) (*types.Transaction, error) {
	return _IPositionManager.Contract.OpenPosition(&_IPositionManager.TransactOpts, feedId, collateralAmount, leverageBps, isLong, pythUpdateData)
}

// OpenPosition is a paid mutator transaction binding the contract method 0x0d5ef376.
//
// Solidity: function openPosition(bytes32 feedId, uint256 collateralAmount, uint256 leverageBps, bool isLong, bytes[] pythUpdateData) returns(uint256 positionId)
func (_IPositionManager *IPositionManagerTransactorSession) OpenPosition(feedId [32]byte, collateralAmount *big.Int, leverageBps *big.Int, isLong bool, pythUpdateData [][]byte) (*types.Transaction, error) {
	return _IPositionManager.Contract.OpenPosition(&_IPositionManager.TransactOpts, feedId, collateralAmount, leverageBps, isLong, pythUpdateData)
}

// OpenPositionFor is a paid mutator transaction binding the contract method 0x5abdc988.
//
// Solidity: function openPositionFor(address sessionKey, bytes32 feedId, uint256 collateralAmount, uint256 leverageBps, bool isLong, bytes[] pythUpdateData) returns(uint256 positionId)
func (_IPositionManager *IPositionManagerTransactor) OpenPositionFor(opts *bind.TransactOpts, sessionKey common.Address, feedId [32]byte, collateralAmount *big.Int, leverageBps *big.Int, isLong bool, pythUpdateData [][]byte) (*types.Transaction, error) {
	return _IPositionManager.contract.Transact(opts, "openPositionFor", sessionKey, feedId, collateralAmount, leverageBps, isLong, pythUpdateData)
}

// OpenPositionFor is a paid mutator transaction binding the contract method 0x5abdc988.
//
// Solidity: function openPositionFor(address sessionKey, bytes32 feedId, uint256 collateralAmount, uint256 leverageBps, bool isLong, bytes[] pythUpdateData) returns(uint256 positionId)
func (_IPositionManager *IPositionManagerSession) OpenPositionFor(sessionKey common.Address, feedId [32]byte, collateralAmount *big.Int, leverageBps *big.Int, isLong bool, pythUpdateData [][]byte) (*types.Transaction, error) {
	return _IPositionManager.Contract.OpenPositionFor(&_IPositionManager.TransactOpts, sessionKey, feedId, collateralAmount, leverageBps, isLong, pythUpdateData)
}

// OpenPositionFor is a paid mutator transaction binding the contract method 0x5abdc988.
//
// Solidity: function openPositionFor(address sessionKey, bytes32 feedId, uint256 collateralAmount, uint256 leverageBps, bool isLong, bytes[] pythUpdateData) returns(uint256 positionId)
func (_IPositionManager *IPositionManagerTransactorSession) OpenPositionFor(sessionKey common.Address, feedId [32]byte, collateralAmount *big.Int, leverageBps *big.Int, isLong bool, pythUpdateData [][]byte) (*types.Transaction, error) {
	return _IPositionManager.Contract.OpenPositionFor(&_IPositionManager.TransactOpts, sessionKey, feedId, collateralAmount, leverageBps, isLong, pythUpdateData)
}

// SetSessionKeyRegistry is a paid mutator transaction binding the contract method 0x8a6a7976.
//
// Solidity: function setSessionKeyRegistry(address registry) returns()
func (_IPositionManager *IPositionManagerTransactor) SetSessionKeyRegistry(opts *bind.TransactOpts, registry common.Address) (*types.Transaction, error) {
	return _IPositionManager.contract.Transact(opts, "setSessionKeyRegistry", registry)
}

// SetSessionKeyRegistry is a paid mutator transaction binding the contract method 0x8a6a7976.
//
// Solidity: function setSessionKeyRegistry(address registry) returns()
func (_IPositionManager *IPositionManagerSession) SetSessionKeyRegistry(registry common.Address) (*types.Transaction, error) {
	return _IPositionManager.Contract.SetSessionKeyRegistry(&_IPositionManager.TransactOpts, registry)
}

// SetSessionKeyRegistry is a paid mutator transaction binding the contract method 0x8a6a7976.
//
// Solidity: function setSessionKeyRegistry(address registry) returns()
func (_IPositionManager *IPositionManagerTransactorSession) SetSessionKeyRegistry(registry common.Address) (*types.Transaction, error) {
	return _IPositionManager.Contract.SetSessionKeyRegistry(&_IPositionManager.TransactOpts, registry)
}

// IPositionManagerFundingAccruedIterator is returned from FilterFundingAccrued and is used to iterate over the raw logs and unpacked data for FundingAccrued events raised by the IPositionManager contract.
type IPositionManagerFundingAccruedIterator struct {
	Event *IPositionManagerFundingAccrued // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *IPositionManagerFundingAccruedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(IPositionManagerFundingAccrued)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(IPositionManagerFundingAccrued)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *IPositionManagerFundingAccruedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *IPositionManagerFundingAccruedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// IPositionManagerFundingAccrued represents a FundingAccrued event raised by the IPositionManager contract.
type IPositionManagerFundingAccrued struct {
	FeedId      [32]byte
	Index       *big.Int
	BlockNumber *big.Int
	SkewWad     *big.Int
	Raw         types.Log // Blockchain specific contextual infos
}

// FilterFundingAccrued is a free log retrieval operation binding the contract event 0x92484ca51fd71b1f301a417d7690080dd602181c800608e68089c4b982d66901.
//
// Solidity: event FundingAccrued(bytes32 indexed feedId, int256 index, uint256 blockNumber, int256 skewWad)
func (_IPositionManager *IPositionManagerFilterer) FilterFundingAccrued(opts *bind.FilterOpts, feedId [][32]byte) (*IPositionManagerFundingAccruedIterator, error) {

	var feedIdRule []interface{}
	for _, feedIdItem := range feedId {
		feedIdRule = append(feedIdRule, feedIdItem)
	}

	logs, sub, err := _IPositionManager.contract.FilterLogs(opts, "FundingAccrued", feedIdRule)
	if err != nil {
		return nil, err
	}
	return &IPositionManagerFundingAccruedIterator{contract: _IPositionManager.contract, event: "FundingAccrued", logs: logs, sub: sub}, nil
}

// WatchFundingAccrued is a free log subscription operation binding the contract event 0x92484ca51fd71b1f301a417d7690080dd602181c800608e68089c4b982d66901.
//
// Solidity: event FundingAccrued(bytes32 indexed feedId, int256 index, uint256 blockNumber, int256 skewWad)
func (_IPositionManager *IPositionManagerFilterer) WatchFundingAccrued(opts *bind.WatchOpts, sink chan<- *IPositionManagerFundingAccrued, feedId [][32]byte) (event.Subscription, error) {

	var feedIdRule []interface{}
	for _, feedIdItem := range feedId {
		feedIdRule = append(feedIdRule, feedIdItem)
	}

	logs, sub, err := _IPositionManager.contract.WatchLogs(opts, "FundingAccrued", feedIdRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(IPositionManagerFundingAccrued)
				if err := _IPositionManager.contract.UnpackLog(event, "FundingAccrued", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseFundingAccrued is a log parse operation binding the contract event 0x92484ca51fd71b1f301a417d7690080dd602181c800608e68089c4b982d66901.
//
// Solidity: event FundingAccrued(bytes32 indexed feedId, int256 index, uint256 blockNumber, int256 skewWad)
func (_IPositionManager *IPositionManagerFilterer) ParseFundingAccrued(log types.Log) (*IPositionManagerFundingAccrued, error) {
	event := new(IPositionManagerFundingAccrued)
	if err := _IPositionManager.contract.UnpackLog(event, "FundingAccrued", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// IPositionManagerFundingSettledIterator is returned from FilterFundingSettled and is used to iterate over the raw logs and unpacked data for FundingSettled events raised by the IPositionManager contract.
type IPositionManagerFundingSettledIterator struct {
	Event *IPositionManagerFundingSettled // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *IPositionManagerFundingSettledIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(IPositionManagerFundingSettled)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(IPositionManagerFundingSettled)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *IPositionManagerFundingSettledIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *IPositionManagerFundingSettledIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// IPositionManagerFundingSettled represents a FundingSettled event raised by the IPositionManager contract.
type IPositionManagerFundingSettled struct {
	PositionId *big.Int
	Amount     *big.Int
	Raw        types.Log // Blockchain specific contextual infos
}

// FilterFundingSettled is a free log retrieval operation binding the contract event 0x7df1100cc711d4a5118d80f33389bc85282b46600cb5cb9bdace869527bdaf2d.
//
// Solidity: event FundingSettled(uint256 indexed positionId, int256 amount)
func (_IPositionManager *IPositionManagerFilterer) FilterFundingSettled(opts *bind.FilterOpts, positionId []*big.Int) (*IPositionManagerFundingSettledIterator, error) {

	var positionIdRule []interface{}
	for _, positionIdItem := range positionId {
		positionIdRule = append(positionIdRule, positionIdItem)
	}

	logs, sub, err := _IPositionManager.contract.FilterLogs(opts, "FundingSettled", positionIdRule)
	if err != nil {
		return nil, err
	}
	return &IPositionManagerFundingSettledIterator{contract: _IPositionManager.contract, event: "FundingSettled", logs: logs, sub: sub}, nil
}

// WatchFundingSettled is a free log subscription operation binding the contract event 0x7df1100cc711d4a5118d80f33389bc85282b46600cb5cb9bdace869527bdaf2d.
//
// Solidity: event FundingSettled(uint256 indexed positionId, int256 amount)
func (_IPositionManager *IPositionManagerFilterer) WatchFundingSettled(opts *bind.WatchOpts, sink chan<- *IPositionManagerFundingSettled, positionId []*big.Int) (event.Subscription, error) {

	var positionIdRule []interface{}
	for _, positionIdItem := range positionId {
		positionIdRule = append(positionIdRule, positionIdItem)
	}

	logs, sub, err := _IPositionManager.contract.WatchLogs(opts, "FundingSettled", positionIdRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(IPositionManagerFundingSettled)
				if err := _IPositionManager.contract.UnpackLog(event, "FundingSettled", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseFundingSettled is a log parse operation binding the contract event 0x7df1100cc711d4a5118d80f33389bc85282b46600cb5cb9bdace869527bdaf2d.
//
// Solidity: event FundingSettled(uint256 indexed positionId, int256 amount)
func (_IPositionManager *IPositionManagerFilterer) ParseFundingSettled(log types.Log) (*IPositionManagerFundingSettled, error) {
	event := new(IPositionManagerFundingSettled)
	if err := _IPositionManager.contract.UnpackLog(event, "FundingSettled", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// IPositionManagerPositionClosedIterator is returned from FilterPositionClosed and is used to iterate over the raw logs and unpacked data for PositionClosed events raised by the IPositionManager contract.
type IPositionManagerPositionClosedIterator struct {
	Event *IPositionManagerPositionClosed // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *IPositionManagerPositionClosedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(IPositionManagerPositionClosed)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(IPositionManagerPositionClosed)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *IPositionManagerPositionClosedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *IPositionManagerPositionClosedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// IPositionManagerPositionClosed represents a PositionClosed event raised by the IPositionManager contract.
type IPositionManagerPositionClosed struct {
	PositionId *big.Int
	Owner      common.Address
	ExitPrice  *big.Int
	Pnl        *big.Int
	Raw        types.Log // Blockchain specific contextual infos
}

// FilterPositionClosed is a free log retrieval operation binding the contract event 0x356fca566f3a054a459c7224d9c9d634f31a98835cfd4fb4c5ddbf8b96aca211.
//
// Solidity: event PositionClosed(uint256 indexed positionId, address indexed owner, uint256 exitPrice, int256 pnl)
func (_IPositionManager *IPositionManagerFilterer) FilterPositionClosed(opts *bind.FilterOpts, positionId []*big.Int, owner []common.Address) (*IPositionManagerPositionClosedIterator, error) {

	var positionIdRule []interface{}
	for _, positionIdItem := range positionId {
		positionIdRule = append(positionIdRule, positionIdItem)
	}
	var ownerRule []interface{}
	for _, ownerItem := range owner {
		ownerRule = append(ownerRule, ownerItem)
	}

	logs, sub, err := _IPositionManager.contract.FilterLogs(opts, "PositionClosed", positionIdRule, ownerRule)
	if err != nil {
		return nil, err
	}
	return &IPositionManagerPositionClosedIterator{contract: _IPositionManager.contract, event: "PositionClosed", logs: logs, sub: sub}, nil
}

// WatchPositionClosed is a free log subscription operation binding the contract event 0x356fca566f3a054a459c7224d9c9d634f31a98835cfd4fb4c5ddbf8b96aca211.
//
// Solidity: event PositionClosed(uint256 indexed positionId, address indexed owner, uint256 exitPrice, int256 pnl)
func (_IPositionManager *IPositionManagerFilterer) WatchPositionClosed(opts *bind.WatchOpts, sink chan<- *IPositionManagerPositionClosed, positionId []*big.Int, owner []common.Address) (event.Subscription, error) {

	var positionIdRule []interface{}
	for _, positionIdItem := range positionId {
		positionIdRule = append(positionIdRule, positionIdItem)
	}
	var ownerRule []interface{}
	for _, ownerItem := range owner {
		ownerRule = append(ownerRule, ownerItem)
	}

	logs, sub, err := _IPositionManager.contract.WatchLogs(opts, "PositionClosed", positionIdRule, ownerRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(IPositionManagerPositionClosed)
				if err := _IPositionManager.contract.UnpackLog(event, "PositionClosed", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParsePositionClosed is a log parse operation binding the contract event 0x356fca566f3a054a459c7224d9c9d634f31a98835cfd4fb4c5ddbf8b96aca211.
//
// Solidity: event PositionClosed(uint256 indexed positionId, address indexed owner, uint256 exitPrice, int256 pnl)
func (_IPositionManager *IPositionManagerFilterer) ParsePositionClosed(log types.Log) (*IPositionManagerPositionClosed, error) {
	event := new(IPositionManagerPositionClosed)
	if err := _IPositionManager.contract.UnpackLog(event, "PositionClosed", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// IPositionManagerPositionLiquidatedIterator is returned from FilterPositionLiquidated and is used to iterate over the raw logs and unpacked data for PositionLiquidated events raised by the IPositionManager contract.
type IPositionManagerPositionLiquidatedIterator struct {
	Event *IPositionManagerPositionLiquidated // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *IPositionManagerPositionLiquidatedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(IPositionManagerPositionLiquidated)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(IPositionManagerPositionLiquidated)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *IPositionManagerPositionLiquidatedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *IPositionManagerPositionLiquidatedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// IPositionManagerPositionLiquidated represents a PositionLiquidated event raised by the IPositionManager contract.
type IPositionManagerPositionLiquidated struct {
	PositionId *big.Int
	Owner      common.Address
	Liquidator common.Address
	ExitPrice  *big.Int
	Reward     *big.Int
	Raw        types.Log // Blockchain specific contextual infos
}

// FilterPositionLiquidated is a free log retrieval operation binding the contract event 0xc5e439014621093f892ab10677ff2750118e56979de7407e558318e030f151d2.
//
// Solidity: event PositionLiquidated(uint256 indexed positionId, address indexed owner, address indexed liquidator, uint256 exitPrice, uint256 reward)
func (_IPositionManager *IPositionManagerFilterer) FilterPositionLiquidated(opts *bind.FilterOpts, positionId []*big.Int, owner []common.Address, liquidator []common.Address) (*IPositionManagerPositionLiquidatedIterator, error) {

	var positionIdRule []interface{}
	for _, positionIdItem := range positionId {
		positionIdRule = append(positionIdRule, positionIdItem)
	}
	var ownerRule []interface{}
	for _, ownerItem := range owner {
		ownerRule = append(ownerRule, ownerItem)
	}
	var liquidatorRule []interface{}
	for _, liquidatorItem := range liquidator {
		liquidatorRule = append(liquidatorRule, liquidatorItem)
	}

	logs, sub, err := _IPositionManager.contract.FilterLogs(opts, "PositionLiquidated", positionIdRule, ownerRule, liquidatorRule)
	if err != nil {
		return nil, err
	}
	return &IPositionManagerPositionLiquidatedIterator{contract: _IPositionManager.contract, event: "PositionLiquidated", logs: logs, sub: sub}, nil
}

// WatchPositionLiquidated is a free log subscription operation binding the contract event 0xc5e439014621093f892ab10677ff2750118e56979de7407e558318e030f151d2.
//
// Solidity: event PositionLiquidated(uint256 indexed positionId, address indexed owner, address indexed liquidator, uint256 exitPrice, uint256 reward)
func (_IPositionManager *IPositionManagerFilterer) WatchPositionLiquidated(opts *bind.WatchOpts, sink chan<- *IPositionManagerPositionLiquidated, positionId []*big.Int, owner []common.Address, liquidator []common.Address) (event.Subscription, error) {

	var positionIdRule []interface{}
	for _, positionIdItem := range positionId {
		positionIdRule = append(positionIdRule, positionIdItem)
	}
	var ownerRule []interface{}
	for _, ownerItem := range owner {
		ownerRule = append(ownerRule, ownerItem)
	}
	var liquidatorRule []interface{}
	for _, liquidatorItem := range liquidator {
		liquidatorRule = append(liquidatorRule, liquidatorItem)
	}

	logs, sub, err := _IPositionManager.contract.WatchLogs(opts, "PositionLiquidated", positionIdRule, ownerRule, liquidatorRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(IPositionManagerPositionLiquidated)
				if err := _IPositionManager.contract.UnpackLog(event, "PositionLiquidated", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParsePositionLiquidated is a log parse operation binding the contract event 0xc5e439014621093f892ab10677ff2750118e56979de7407e558318e030f151d2.
//
// Solidity: event PositionLiquidated(uint256 indexed positionId, address indexed owner, address indexed liquidator, uint256 exitPrice, uint256 reward)
func (_IPositionManager *IPositionManagerFilterer) ParsePositionLiquidated(log types.Log) (*IPositionManagerPositionLiquidated, error) {
	event := new(IPositionManagerPositionLiquidated)
	if err := _IPositionManager.contract.UnpackLog(event, "PositionLiquidated", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// IPositionManagerPositionOpenedIterator is returned from FilterPositionOpened and is used to iterate over the raw logs and unpacked data for PositionOpened events raised by the IPositionManager contract.
type IPositionManagerPositionOpenedIterator struct {
	Event *IPositionManagerPositionOpened // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *IPositionManagerPositionOpenedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(IPositionManagerPositionOpened)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(IPositionManagerPositionOpened)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *IPositionManagerPositionOpenedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *IPositionManagerPositionOpenedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// IPositionManagerPositionOpened represents a PositionOpened event raised by the IPositionManager contract.
type IPositionManagerPositionOpened struct {
	PositionId    *big.Int
	Owner         common.Address
	FeedId        [32]byte
	CollateralUsd *big.Int
	SizeUsd       *big.Int
	EntryPrice    *big.Int
	IsLong        bool
	Raw           types.Log // Blockchain specific contextual infos
}

// FilterPositionOpened is a free log retrieval operation binding the contract event 0x3ffd7fd948c5e90086b70ba6a934fa1faed10bb524bb094bc1607b84cc6c5832.
//
// Solidity: event PositionOpened(uint256 indexed positionId, address indexed owner, bytes32 indexed feedId, uint256 collateralUsd, uint256 sizeUsd, uint256 entryPrice, bool isLong)
func (_IPositionManager *IPositionManagerFilterer) FilterPositionOpened(opts *bind.FilterOpts, positionId []*big.Int, owner []common.Address, feedId [][32]byte) (*IPositionManagerPositionOpenedIterator, error) {

	var positionIdRule []interface{}
	for _, positionIdItem := range positionId {
		positionIdRule = append(positionIdRule, positionIdItem)
	}
	var ownerRule []interface{}
	for _, ownerItem := range owner {
		ownerRule = append(ownerRule, ownerItem)
	}
	var feedIdRule []interface{}
	for _, feedIdItem := range feedId {
		feedIdRule = append(feedIdRule, feedIdItem)
	}

	logs, sub, err := _IPositionManager.contract.FilterLogs(opts, "PositionOpened", positionIdRule, ownerRule, feedIdRule)
	if err != nil {
		return nil, err
	}
	return &IPositionManagerPositionOpenedIterator{contract: _IPositionManager.contract, event: "PositionOpened", logs: logs, sub: sub}, nil
}

// WatchPositionOpened is a free log subscription operation binding the contract event 0x3ffd7fd948c5e90086b70ba6a934fa1faed10bb524bb094bc1607b84cc6c5832.
//
// Solidity: event PositionOpened(uint256 indexed positionId, address indexed owner, bytes32 indexed feedId, uint256 collateralUsd, uint256 sizeUsd, uint256 entryPrice, bool isLong)
func (_IPositionManager *IPositionManagerFilterer) WatchPositionOpened(opts *bind.WatchOpts, sink chan<- *IPositionManagerPositionOpened, positionId []*big.Int, owner []common.Address, feedId [][32]byte) (event.Subscription, error) {

	var positionIdRule []interface{}
	for _, positionIdItem := range positionId {
		positionIdRule = append(positionIdRule, positionIdItem)
	}
	var ownerRule []interface{}
	for _, ownerItem := range owner {
		ownerRule = append(ownerRule, ownerItem)
	}
	var feedIdRule []interface{}
	for _, feedIdItem := range feedId {
		feedIdRule = append(feedIdRule, feedIdItem)
	}

	logs, sub, err := _IPositionManager.contract.WatchLogs(opts, "PositionOpened", positionIdRule, ownerRule, feedIdRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(IPositionManagerPositionOpened)
				if err := _IPositionManager.contract.UnpackLog(event, "PositionOpened", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParsePositionOpened is a log parse operation binding the contract event 0x3ffd7fd948c5e90086b70ba6a934fa1faed10bb524bb094bc1607b84cc6c5832.
//
// Solidity: event PositionOpened(uint256 indexed positionId, address indexed owner, bytes32 indexed feedId, uint256 collateralUsd, uint256 sizeUsd, uint256 entryPrice, bool isLong)
func (_IPositionManager *IPositionManagerFilterer) ParsePositionOpened(log types.Log) (*IPositionManagerPositionOpened, error) {
	event := new(IPositionManagerPositionOpened)
	if err := _IPositionManager.contract.UnpackLog(event, "PositionOpened", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}
